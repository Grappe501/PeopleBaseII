/**
 * Election results import (aligned with sql/004, 012, 013_election_results_mixed_geography.sql).
 *
 * Writes:
 *   - raw_election_results (full row JSON + source_file_name)
 *   - elections, races, race_candidates, election_contests
 *   - election_results (state / county / precinct scopes)
 *   - county_election_results for county-level rows (analytics compatibility)
 *   - election_import_log
 *
 * Formats:
 *   - SOS (default auto): Arkansas-style columns Contest ID, Contest Name, Location, ...
 *   - Legacy: election_key, election_year, race_key, office_name, county, precinct_name, ...
 *
 * Usage:
 *   npx tsx scripts/import-election-results.ts --file path/to/file.csv
 *   npx tsx scripts/import-election-results.ts --dir data/Elections/2026
 *   npx tsx scripts/import-election-results.ts --file x.csv --source-file custom-label.csv
 *   npx tsx scripts/import-election-results.ts --file x.csv --format legacy
 */
import "./_dotenv-path";
import "dotenv/config";

import fs from "fs";
import path from "path";
import csv from "csv-parser";
import postgres, { type Sql } from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

type Row = Record<string, string>;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function alias(row: Row, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

type FileMeta = {
  electionKey: string;
  electionYear: number;
  electionType: string;
  description: string | null;
  countyHint: string | null;
};

/** Parse Arkansas election CSV filenames into election metadata. */
function parseFilenameMeta(basename: string): FileMeta {
  const base = basename.replace(/\.csv$/i, "");
  let year: number;
  let slug: string;
  let countyHint: string | null = null;

  if (/^\d{4}_/.test(base)) {
    const m = base.match(/^(\d{4})_(.+)$/);
    if (!m) throw new Error(`Unrecognized election filename: ${basename}`);
    year = Number(m[1]);
    slug = m[2] ?? "";
  } else {
    const m = base.match(/^(.+)_(\d{4})_(.+)$/);
    if (!m) {
      throw new Error(`Unrecognized election filename: ${basename}`);
    }
    countyHint = m[1]!.replace(/_/g, " ").trim();
    year = Number(m[2]);
    slug = m[3] ?? "";
  }

  const slugParts = slug.split("_").filter(Boolean);
  const head = (slugParts[0] ?? "").toLowerCase();
  let electionType = "general";
  if (head === "preferential" && slugParts[1]?.toLowerCase() === "primary") {
    electionType = "preferential_primary";
  } else if (head === "primary" && slugParts[1]?.toLowerCase() === "runoff") {
    electionType = "primary_runoff";
  } else if (head === "general") {
    electionType = "general";
  } else if (head === "special") {
    const sub = slugParts.slice(1).map((s) => s.toLowerCase()).join("_");
    if (sub.startsWith("primary_election")) electionType = "special_primary";
    else if (sub.startsWith("runoff_election")) electionType = "special_runoff";
    else electionType = `special_${sub || "other"}`;
  } else {
    electionType = slugParts
      .slice(0, 2)
      .map((s) => s.toLowerCase())
      .join("_");
  }

  const keyBody = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const electionKey = `${year}_${keyBody}`;

  const descParts: string[] = [];
  if (countyHint) descParts.push(`County file: ${countyHint}`);
  descParts.push(slug.replace(/_/g, " "));

  return {
    electionKey,
    electionYear: year,
    electionType,
    description: descParts.length ? descParts.join(" · ") : null,
    countyHint,
  };
}

function inferPartyFromContest(contestName: string): string | null {
  const u = contestName.toUpperCase();
  if (u.startsWith("REP ")) return "REP";
  if (u.startsWith("DEM ")) return "DEM";
  if (u.startsWith("LIB ")) return "LIB";
  if (u.startsWith("NON ")) return "NON";
  if (u.startsWith("GRN ")) return "GRN";
  return null;
}

function inferPartisan(contestName: string): boolean {
  return inferPartyFromContest(contestName) !== null;
}

async function resolveCountyId(
  sql: Sql,
  countyLabel: string,
): Promise<number | null> {
  const name = countyLabel.trim();
  if (!name) return null;
  const rows = await sql<[{ id: string | number }]>`
    select id from geo_counties
    where state_fips = '05'
      and normalized_county_name = normalize_geo_name(${name})
    limit 1
  `;
  return rows[0] ? Number(rows[0].id) : null;
}

async function upsertElection(
  sql: Sql,
  meta: FileMeta,
): Promise<number> {
  const rows = await sql<[{ id: string | number }]>`
    insert into elections (election_key, election_date, election_year, election_type, description)
    values (${meta.electionKey}, null, ${meta.electionYear}, ${meta.electionType}, ${meta.description})
    on conflict (election_key) do update set
      election_year = excluded.election_year,
      election_type = excluded.election_type,
      description = coalesce(excluded.description, elections.description),
      updated_at = now()
    returning id
  `;
  return Number(rows[0].id);
}

async function upsertRaceForContest(
  sql: Sql,
  electionId: number,
  meta: FileMeta,
  raceKey: string,
  officeName: string,
  isPartisan: boolean,
): Promise<number> {
  const rows = await sql<[{ id: string | number }]>`
    insert into races (election_id, race_key, office_name, district_type, district_code, seat_name, is_partisan)
    values (${electionId}, ${raceKey}, ${officeName}, null, null, null, ${isPartisan})
    on conflict (race_key) do update set
      office_name = excluded.office_name,
      is_partisan = excluded.is_partisan,
      updated_at = now()
    returning id
  `;
  return Number(rows[0].id);
}

async function upsertElectionContest(
  sql: Sql,
  electionId: number,
  providerContestId: string,
  contestName: string,
  raceId: number,
): Promise<number> {
  const rows = await sql<[{ id: string | number }]>`
    insert into election_contests (election_id, provider_contest_id, contest_name, race_id)
    values (${electionId}, ${providerContestId}, ${contestName}, ${raceId})
    on conflict (election_id, provider_contest_id) do update set
      contest_name = excluded.contest_name,
      race_id = excluded.race_id,
      updated_at = now()
    returning id
  `;
  return Number(rows[0].id);
}

async function ensureCandidate(
  sql: Sql,
  raceId: number,
  name: string,
  party: string | null,
): Promise<void> {
  const existing = await sql<[{ id: string | number }]>`
    select id from race_candidates
    where race_id = ${raceId} and candidate_name = ${name}
    limit 1
  `;
  if (existing.length) return;
  await sql`
    insert into race_candidates (race_id, candidate_name, party, ballot_order)
    values (${raceId}, ${name}, ${party}, null)
  `;
}

type GeographyType = "statewide" | "county" | "precinct" | "district";

/** Maps normalized geography to legacy result_scope column (012 check constraint). */
function geographyToResultScope(
  g: GeographyType,
): "state" | "county" | "precinct" | "district" {
  return g === "statewide" ? "state" : g;
}

/**
 * When Location is a district label (not a county name and not "County - precinct").
 * Arkansas SOS sometimes publishes true district-only rows; most district contests still use county labels.
 */
function tryParseReportingDistrict(locationRaw: string): {
  reportingDistrictType: string;
  reportingDistrictCode: string;
} | null {
  const s = locationRaw.trim();
  const patterns: { re: RegExp; reportingDistrictType: string }[] = [
    {
      re: /^u\.?s\.?\s*congress(?:ional)?\s+district\s*0*(\d+)\s*$/i,
      reportingDistrictType: "us_congress",
    },
    {
      re: /^congressional\s+district\s*0*(\d+)\s*$/i,
      reportingDistrictType: "us_congress",
    },
    {
      re: /^state\s+senate\s+district\s*0*(\d+)\s*$/i,
      reportingDistrictType: "state_senate",
    },
    {
      re: /^state\s+(?:representative|rep\.?|house)\s+district\s*0*(\d+)\s*$/i,
      reportingDistrictType: "state_house",
    },
    { re: /^district\s*0*(\d+)\s*$/i, reportingDistrictType: "unknown_district" },
  ];
  for (const { re, reportingDistrictType } of patterns) {
    const m = s.match(re);
    if (m?.[1]) {
      return {
        reportingDistrictType,
        reportingDistrictCode: String(Number.parseInt(m[1], 10)),
      };
    }
  }
  return null;
}

/**
 * Classify SOS "Location" column: statewide, county aggregates, precinct ("County - code"),
 * or rare district-only labels.
 */
function classifySosGeography(
  locationRaw: string,
  meta: FileMeta,
): {
  geographyType: GeographyType;
  resultScope: ReturnType<typeof geographyToResultScope>;
  countyName: string | null;
  locationLabel: string;
  locationRawOut: string;
  sourcePrecinctCode: string | null;
  sourcePrecinctName: string | null;
  reportingDistrictType: string | null;
  reportingDistrictCode: string | null;
} {
  const loc = locationRaw.trim();
  const emptyCounty = {
    geographyType: "county" as const,
    resultScope: geographyToResultScope("county"),
    countyName: meta.countyHint,
    locationLabel: "",
    locationRawOut: loc,
    sourcePrecinctCode: null,
    sourcePrecinctName: null,
    reportingDistrictType: null,
    reportingDistrictCode: null,
  };
  if (!loc) {
    return emptyCounty;
  }
  if (/^arkansas$/i.test(loc)) {
    return {
      geographyType: "statewide",
      resultScope: geographyToResultScope("statewide"),
      countyName: null,
      locationLabel: loc,
      locationRawOut: loc,
      sourcePrecinctCode: null,
      sourcePrecinctName: null,
      reportingDistrictType: null,
      reportingDistrictCode: null,
    };
  }
  const dash = /\s+-\s+/.exec(loc);
  if (dash) {
    const countyPart = loc.slice(0, dash.index).trim();
    const rest = loc.slice((dash.index ?? 0) + dash[0].length).trim();
    return {
      geographyType: "precinct",
      resultScope: geographyToResultScope("precinct"),
      countyName: countyPart || meta.countyHint,
      locationLabel: loc,
      locationRawOut: loc,
      sourcePrecinctCode: rest || null,
      sourcePrecinctName: loc,
      reportingDistrictType: null,
      reportingDistrictCode: null,
    };
  }
  const district = tryParseReportingDistrict(loc);
  if (district) {
    return {
      geographyType: "district",
      resultScope: geographyToResultScope("district"),
      countyName: null,
      locationLabel: loc,
      locationRawOut: loc,
      sourcePrecinctCode: null,
      sourcePrecinctName: null,
      reportingDistrictType: district.reportingDistrictType,
      reportingDistrictCode: district.reportingDistrictCode,
    };
  }
  return {
    geographyType: "county",
    resultScope: geographyToResultScope("county"),
    countyName: loc,
    locationLabel: loc,
    locationRawOut: loc,
    sourcePrecinctCode: null,
    sourcePrecinctName: null,
    reportingDistrictType: null,
    reportingDistrictCode: null,
  };
}

async function deletePriorImport(sql: Sql, sourceFile: string): Promise<void> {
  await sql`delete from election_results where source_file_name = ${sourceFile}`;
  await sql`delete from raw_election_results where source_file_name = ${sourceFile}`;
  await sql`delete from county_election_results where source_file_name = ${sourceFile}`;
}

type ImportStats = { rowsRead: number; rowsInserted: number; rowsSkipped: number };

async function importSosFile(
  sql: Sql,
  filePath: string,
  sourceFile: string,
  meta: FileMeta,
): Promise<ImportStats> {
  let rowsRead = 0;
  let rowsInserted = 0;
  let rowsSkipped = 0;

  await deletePriorImport(sql, sourceFile);

  const electionId = await upsertElection(sql, meta);

  const stream = fs.createReadStream(filePath).pipe(csv());
  let rowNum = 0;

  const contestCache = new Map<
    string,
    { contestPk: number; raceId: number }
  >();

  for await (const raw of stream) {
    rowsRead++;
    rowNum++;
    const row = raw as Row;
    const mapped: Row = {};
    for (const [k, v] of Object.entries(row)) {
      mapped[normHeader(k)] = v ?? "";
    }

    const payload = { ...mapped };
    await sql`
      insert into raw_election_results (source_file_name, row_num, payload)
      values (${sourceFile}, ${rowNum}, ${sql.json(payload)})
    `;

    try {
      const providerContestId = alias(
        mapped,
        "contest_id",
        "contestid",
      );
      const contestName = alias(mapped, "contest_name", "contestname");
      const locationRaw = alias(mapped, "location");
      const candidateName = alias(
        mapped,
        "candidate_name",
        "candidatename",
      );
      const votesStr = alias(
        mapped,
        "candidate_votes",
        "candidatevotes",
        "votes",
      );
      const totalVotesStr = alias(mapped, "total_votes", "totalvotes");
      const pctStr = alias(
        mapped,
        "candidate_vote_percentage",
        "candidatevotepercentage",
      );

      if (!providerContestId || !contestName || !candidateName) {
        rowsSkipped++;
        continue;
      }

      const votes = Number(votesStr.replace(/,/g, ""));
      if (!Number.isFinite(votes)) {
        rowsSkipped++;
        continue;
      }

      const totalAtLoc = Number(String(totalVotesStr).replace(/,/g, ""));
      const voteShare = Number(String(pctStr).replace(/,/g, ""));
      const party = inferPartyFromContest(contestName);

      let raceId: number;
      let contestPk: number;
      const ck = `${electionId}:${providerContestId}`;
      const cached = contestCache.get(ck);
      if (cached) {
        raceId = cached.raceId;
        contestPk = cached.contestPk;
      } else {
        const raceKey = `${meta.electionKey}:${providerContestId}`;
        raceId = await upsertRaceForContest(
          sql,
          electionId,
          meta,
          raceKey,
          contestName,
          inferPartisan(contestName),
        );
        contestPk = await upsertElectionContest(
          sql,
          electionId,
          providerContestId,
          contestName,
          raceId,
        );
        contestCache.set(ck, { contestPk, raceId });
      }

      await ensureCandidate(sql, raceId, candidateName, party);

      const loc = classifySosGeography(locationRaw, meta);
      let countyId: number | null = null;
      if (loc.countyName) {
        countyId = await resolveCountyId(sql, loc.countyName);
      }
      if (
        (loc.geographyType === "county" || loc.geographyType === "precinct") &&
        countyId === null
      ) {
        rowsSkipped++;
        continue;
      }

      await sql`
        insert into election_results (
          race_id, contest_id, result_scope, geography_type, county_id, location_label, location_raw,
          source_precinct_code, source_precinct_name,
          reporting_district_type, reporting_district_code,
          candidate_name, party, votes, total_votes_at_location, vote_share_pct, source_file_name
        )
        values (
          ${raceId}, ${contestPk}, ${loc.resultScope}, ${loc.geographyType}, ${countyId},
          ${loc.locationLabel || null}, ${loc.locationRawOut || null},
          ${loc.sourcePrecinctCode}, ${loc.sourcePrecinctName},
          ${loc.reportingDistrictType}, ${loc.reportingDistrictCode},
          ${candidateName}, ${party}, ${Math.round(votes)},
          ${Number.isFinite(totalAtLoc) ? Math.round(totalAtLoc) : null},
          ${Number.isFinite(voteShare) ? voteShare : null},
          ${sourceFile}
        )
      `;

      if (loc.geographyType === "county" && countyId !== null) {
        await sql`
          insert into county_election_results (
            race_id, county_id, candidate_name, party, votes, source_file_name
          )
          values (${raceId}, ${countyId}, ${candidateName}, ${party}, ${Math.round(votes)}, ${sourceFile})
          on conflict (race_id, county_id, candidate_name) do update set
            votes = excluded.votes,
            party = excluded.party,
            source_file_name = excluded.source_file_name,
            updated_at = now()
        `;
      }

      rowsInserted++;
    } catch (e) {
      rowsSkipped++;
      console.warn(`Skip row ${rowsRead} (${sourceFile}):`, e);
    }
  }

  return { rowsRead, rowsInserted, rowsSkipped };
}

async function importLegacyFile(
  sql: Sql,
  filePath: string,
  sourceFile: string,
  meta: FileMeta,
): Promise<ImportStats> {
  let rowsRead = 0;
  let rowsInserted = 0;
  let rowsSkipped = 0;

  await deletePriorImport(sql, sourceFile);

  const stream = fs.createReadStream(filePath).pipe(csv());
  let rowNum = 0;

  for await (const raw of stream) {
    rowsRead++;
    rowNum++;
    const row = raw as Row;
    const mapped: Row = {};
    for (const [k, v] of Object.entries(row)) {
      mapped[normHeader(k)] = v ?? "";
    }

    await sql`
      insert into raw_election_results (source_file_name, row_num, payload)
      values (${sourceFile}, ${rowNum}, ${sql.json(mapped)})
    `;

    try {
      const electionKeyRow = alias(mapped, "election_key", "electionkey");
      const year = Number(alias(mapped, "election_year", "electionyear"));
      const electionType =
        alias(mapped, "election_type", "electiontype") || meta.electionType;
      const dateStr = alias(mapped, "election_date", "electiondate");
      const description = alias(mapped, "description") || meta.description;

      const ek = electionKeyRow || meta.electionKey;
      const y = Number.isFinite(year) ? year : meta.electionYear;

      await sql`
        insert into elections (election_key, election_date, election_year, election_type, description)
        values (${ek}, ${dateStr || null}, ${y}, ${electionType}, ${description})
        on conflict (election_key) do update set
          election_date = coalesce(excluded.election_date, elections.election_date),
          election_year = excluded.election_year,
          election_type = excluded.election_type,
          description = coalesce(excluded.description, elections.description),
          updated_at = now()
      `;

      const eRows = await sql<[{ id: string | number }]>`
        select id from elections where election_key = ${ek} limit 1
      `;
      const eid = Number(eRows[0]!.id);

      const raceKey = alias(mapped, "race_key", "racekey");
      const officeName = alias(mapped, "office_name", "officename");
      if (!raceKey || !officeName) {
        rowsSkipped++;
        continue;
      }

      const districtType = alias(mapped, "district_type", "districttype") || null;
      const districtCode = alias(mapped, "district_code", "districtcode") || null;
      const seatName = alias(mapped, "seat_name", "seatname") || null;
      const partisanStr = alias(mapped, "is_partisan", "ispartisan").toLowerCase();
      const isPartisan =
        partisanStr === "false" || partisanStr === "0" ? false : true;

      const rRows = await sql<[{ id: string | number }]>`
        insert into races (election_id, race_key, office_name, district_type, district_code, seat_name, is_partisan)
        values (${eid}, ${raceKey}, ${officeName}, ${districtType}, ${districtCode}, ${seatName}, ${isPartisan})
        on conflict (race_key) do update set
          office_name = excluded.office_name,
          district_type = excluded.district_type,
          district_code = excluded.district_code,
          seat_name = excluded.seat_name,
          is_partisan = excluded.is_partisan,
          updated_at = now()
        returning id
      `;
      const raceId = Number(rRows[0].id);

      const providerContestId = alias(mapped, "contest_id", "provider_contest_id") || raceKey;
      const contestName = alias(mapped, "contest_name") || officeName;
      const contestPk = await upsertElectionContest(
        sql,
        eid,
        providerContestId,
        contestName,
        raceId,
      );

      const countyName = alias(mapped, "county", "county_name");
      const precinctName = alias(
        mapped,
        "precinct_name",
        "precinctname",
        "precinct",
      );
      const precinctCode = alias(mapped, "precinct_code", "precinctcode") || null;
      const candidateName = alias(
        mapped,
        "candidate_name",
        "candidatename",
        "candidate",
      );
      const party = alias(mapped, "party") || null;
      const votes = Number(alias(mapped, "votes", "vote_total"));

      const hasPrecinct =
        Boolean(precinctName.trim()) || Boolean(precinctCode?.trim());
      if (!countyName || !candidateName || !Number.isFinite(votes)) {
        rowsSkipped++;
        continue;
      }

      const countyId = await resolveCountyId(sql, countyName);
      if (countyId === null) {
        rowsSkipped++;
        continue;
      }

      await ensureCandidate(sql, raceId, candidateName, party);

      const geographyType: GeographyType = hasPrecinct ? "precinct" : "county";
      const rs = geographyToResultScope(geographyType);
      const locLabel = hasPrecinct
        ? `${countyName} - ${(precinctCode ?? "").trim() || precinctName.trim()}`
        : countyName;
      const locationRawOut = hasPrecinct ? locLabel : countyName;

      await sql`
        insert into election_results (
          race_id, contest_id, result_scope, geography_type, county_id, location_label, location_raw,
          source_precinct_code, source_precinct_name,
          reporting_district_type, reporting_district_code,
          candidate_name, party, votes, total_votes_at_location, vote_share_pct, source_file_name
        )
        values (
          ${raceId}, ${contestPk}, ${rs}, ${geographyType}, ${countyId}, ${locLabel}, ${locationRawOut},
          ${hasPrecinct ? precinctCode : null},
          ${hasPrecinct ? precinctName || null : null},
          null, null,
          ${candidateName}, ${party}, ${Math.round(votes)}, null, null,
          ${sourceFile}
        )
      `;

      if (geographyType === "county") {
        await sql`
          insert into county_election_results (
            race_id, county_id, candidate_name, party, votes, source_file_name
          )
          values (${raceId}, ${countyId}, ${candidateName}, ${party}, ${Math.round(votes)}, ${sourceFile})
          on conflict (race_id, county_id, candidate_name) do update set
            votes = excluded.votes,
            party = excluded.party,
            source_file_name = excluded.source_file_name,
            updated_at = now()
        `;
      }

      rowsInserted++;
    } catch (e) {
      rowsSkipped++;
      console.warn(`Skip legacy row ${rowsRead}:`, e);
    }
  }

  return { rowsRead, rowsInserted, rowsSkipped };
}

function detectFormat(headers: string[]): "sos" | "legacy" {
  const n = headers.map(normHeader);
  if (n.includes("contest_id") && n.includes("location")) return "sos";
  return "legacy";
}

async function peekCsvHeaders(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(csv());
    stream.once("data", (row: Row) => {
      stream.destroy();
      resolve(Object.keys(row));
    });
    stream.once("error", reject);
    stream.once("end", () => resolve([]));
  });
}

async function importOneFile(
  sql: Sql,
  filePath: string,
  sourceFile: string,
  formatArg: string | undefined,
): Promise<ImportStats> {
  const headers = await peekCsvHeaders(filePath);
  const fmt =
    formatArg === "legacy"
      ? "legacy"
      : formatArg === "sos"
        ? "sos"
        : detectFormat(headers);

  const meta = parseFilenameMeta(path.basename(filePath));

  if (fmt === "sos") {
    return importSosFile(sql, filePath, sourceFile, meta);
  }
  return importLegacyFile(sql, filePath, sourceFile, meta);
}

function listCsvFiles(dir: string): string[] {
  const abs = path.resolve(dir);
  if (!fs.statSync(abs).isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }
  return fs
    .readdirSync(abs)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort()
    .map((f) => path.join(abs, f));
}

async function main(): Promise<void> {
  const filePath = arg("--file");
  const dirPath = arg("--dir");
  const sourceOverride = arg("--source-file");
  const formatArg = arg("--format");

  if ((!filePath && !dirPath) || (filePath && dirPath)) {
    console.error(
      "Usage: --file path/to.csv | --dir path/to/folder [--source-file label] [--format sos|legacy]",
    );
    process.exit(1);
  }

  const dbUrl = requireDatabaseUrl();
  const sql = postgres(dbUrl, { ssl: "require", max: 3 });

  const targets: { path: string; sourceFile: string }[] = [];
  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    targets.push({
      path: filePath,
      sourceFile: sourceOverride ?? path.basename(filePath),
    });
  } else {
    const files = listCsvFiles(dirPath!);
    if (!files.length) {
      console.error(`No CSV files in ${dirPath}`);
      process.exit(1);
    }
    if (sourceOverride) {
      console.warn(
        "Ignoring --source-file when using --dir (each CSV uses its own basename).",
      );
    }
    for (const p of files) {
      targets.push({
        path: p,
        sourceFile: path.basename(p),
      });
    }
  }

  let totalRead = 0;
  let totalIns = 0;
  let totalSkip = 0;

  const multi = targets.length > 1;
  for (const t of targets) {
    if (multi) console.log(`\n--- ${t.sourceFile} ---`);
    const result = await importOneFile(sql, t.path, t.sourceFile, formatArg);
    totalRead += result.rowsRead;
    totalIns += result.rowsInserted;
    totalSkip += result.rowsSkipped;

    await sql`
      insert into election_import_log (source_file, rows_read, rows_inserted, rows_skipped, message)
      values (${t.sourceFile}, ${result.rowsRead}, ${result.rowsInserted}, ${result.rowsSkipped}, ${"election_results"})
    `;
    console.log(
      `Election import ${t.sourceFile}: read ${result.rowsRead}, inserted ${result.rowsInserted}, skipped ${result.rowsSkipped}`,
    );
  }

  if (multi) {
    console.log(
      `\nTotal: read ${totalRead}, inserted ${totalIns}, skipped ${totalSkip}`,
    );
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
