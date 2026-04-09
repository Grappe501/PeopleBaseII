/**
 * Compare VR precinct strings vs election file precinct strings by county.
 * Writes precinct_crosswalk_source_pairs (pending) and precinct_crosswalk_exceptions.
 * Does not auto-insert geo_precinct_aliases (human / guarded workflow).
 *
 * Usage: npx tsx scripts/build-precinct-crosswalk.ts
 */
import "./_dotenv-path";
import "dotenv/config";

import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

const MATCH_MIN = 0.85;
const MATCH_STRONG = 0.95;

function normalizePrecinctKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s._\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = levenshtein(a, b);
  const mx = Math.max(a.length, b.length, 1);
  return 1 - d / mx;
}

async function main() {
  const dbUrl = requireDatabaseUrl();
  const sql = postgres(dbUrl, { ssl: "require", max: 3 });

  await sql`
    delete from precinct_crosswalk_exceptions
    where exception_type = 'no_election_match' and source_system = 'vr'
  `;

  const cols = await sql<[{ column_name: string }]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'raw_vr'
  `;
  const colSet = new Set(cols.map((c) => c.column_name));
  const countyCol = colSet.has("County")
    ? "County"
    : colSet.has("county")
      ? "county"
      : null;
  const precCol = colSet.has("PrecinctName")
    ? "PrecinctName"
    : colSet.has("precinct_name")
      ? "precinct_name"
      : colSet.has("precinct")
        ? "precinct"
        : null;

  if (!countyCol || !precCol) {
    console.error("raw_vr needs County/county and PrecinctName/precinct column");
    process.exit(1);
  }

  const counties = await sql<{ id: string | number; county_name: string }[]>`
    select id, county_name from geo_counties where state_fips = '05'
  `;

  let pairsUpserted = 0;
  let exceptionsLogged = 0;

  for (const c of counties) {
    const countyId = Number(c.id);
    const qCounty = `"${countyCol.replace(/"/g, '""')}"`;
    const qPrec = `"${precCol.replace(/"/g, '""')}"`;
    const safeCountyLiteral = c.county_name.replace(/'/g, "''");

    const vrRows = await sql.unsafe<{ p: string | null }[]>(`
      select distinct trim(${qPrec}::text) as p
      from raw_vr
      where ${qCounty} is not null
        and normalize_geo_name(${qCounty}::text) = normalize_geo_name('${safeCountyLiteral}')
        and ${qPrec} is not null
        and trim(${qPrec}::text) <> ''
    `);

    const vrMap = new Map<string, string>();
    for (const row of vrRows) {
      const raw = row.p ?? "";
      const k = normalizePrecinctKey(raw);
      if (k) vrMap.set(k, raw);
    }

    const elRows = await sql<{ p: string | null }[]>`
      select distinct pr.source_precinct_name as p
      from election_results pr
      where pr.county_id = ${countyId}
        and pr.geography_type = 'precinct'
        and pr.source_precinct_name is not null
        and trim(pr.source_precinct_name) <> ''
    `;

    const elMap = new Map<string, string>();
    for (const row of elRows) {
      const raw = row.p ?? "";
      const k = normalizePrecinctKey(raw);
      if (k) elMap.set(k, raw);
    }

    const precincts = await sql<{ id: string | number; canonical_precinct_name: string | null }[]>`
      select id, canonical_precinct_name from geo_precincts where county_id = ${countyId}
    `;

    function bestPrecinctId(norm: string): number | null {
      let best: { id: number; sc: number } | null = null;
      for (const p of precincts) {
        const name = p.canonical_precinct_name ?? "";
        const nk = normalizePrecinctKey(name);
        if (!nk) continue;
        const sc = similarity(norm, nk);
        if (sc >= MATCH_STRONG && (!best || sc > best.sc)) {
          best = { id: Number(p.id), sc };
        }
      }
      return best?.id ?? null;
    }

    for (const [vrK, vrDisplay] of vrMap) {
      let bestEl = "";
      let bestScore = 0;
      for (const [elK, _elDisplay] of elMap) {
        const sc = similarity(vrK, elK);
        if (sc > bestScore) {
          bestScore = sc;
          bestEl = elK;
        }
      }

      if (bestScore >= MATCH_MIN && bestEl) {
        const elDisplay = elMap.get(bestEl) ?? bestEl;
        const suggestedPrecinctId = bestPrecinctId(vrK) ?? bestPrecinctId(bestEl);
        const reason =
          bestScore >= 1 - 1e-9
            ? "exact_normalized"
            : bestScore >= MATCH_STRONG
              ? "strong_fuzzy"
              : "fuzzy_ge_threshold";

        await sql`
          insert into precinct_crosswalk_source_pairs (
            county_id, vr_normalized_key, election_normalized_key,
            display_vr, display_election, match_score, match_reason, suggested_precinct_id, review_status
          )
          values (
            ${countyId}, ${vrK}, ${bestEl}, ${vrDisplay}, ${elDisplay},
            ${bestScore}, ${reason}, ${suggestedPrecinctId}, 'pending'
          )
          on conflict (county_id, vr_normalized_key, election_normalized_key) do update set
            match_score = excluded.match_score,
            match_reason = excluded.match_reason,
            suggested_precinct_id = excluded.suggested_precinct_id,
            display_vr = excluded.display_vr,
            display_election = excluded.display_election,
            updated_at = now()
        `;
        pairsUpserted++;
      } else {
        await sql`
          insert into precinct_crosswalk_exceptions (
            county_id, source_system, source_normalized_key, source_display,
            exception_type, detail
          )
          values (
            ${countyId}, ${"vr"}, ${vrK}, ${vrDisplay},
            ${"no_election_match"},
            ${`best_score=${bestScore.toFixed(3)}`}
          )
        `;
        exceptionsLogged++;
      }
    }
  }

  console.log(
    `Crosswalk: upserted ${pairsUpserted} source pair rows, logged ${exceptionsLogged} VR exceptions (no election match above ${MATCH_MIN})`,
  );
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
