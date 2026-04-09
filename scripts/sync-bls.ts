/**
 * BLS county sync for Arkansas: LAUS (Public Data API v2) + QCEW (open-data annual CSV by area).
 *
 * Env: DATABASE_URL, BLS_API_KEY (LAUS only; QCEW CSV is unauthenticated).
 *
 * Usage:
 *   npx tsx scripts/sync-bls.ts
 *   npx tsx scripts/sync-bls.ts --laus-only
 *   npx tsx scripts/sync-bls.ts --qcew-only --qcew-year=2023
 */
import "./_dotenv-path";
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import postgres from "postgres";

import {
  lausCountySeriesIds,
  type LausCountyMeasureKey,
} from "@/lib/bls/laus-series";
import {
  QCEW_COUNTY_TOTAL_INDUSTRY,
  QCEW_COUNTY_TOTAL_OWNERSHIP,
  qcewAnnualAreaCsvUrl,
} from "@/lib/bls/qcew-open-data";
import { requireBlsApiKey, requireDatabaseUrl } from "@/lib/env";

const STATE_FIPS = "05";
const AR_COUNTIES_EXPECTED = 75;

const DATA_SOURCE_LAUS = "BLS Public Data API v2 / LAUS county timeseries";
const DATA_SOURCE_QCEW =
  "BLS QCEW Open Data CSV API (annual/a/area; own=0, industry=10)";

type SeriesPoint = { year: string; period: string; value: string };

type BlsResponse = {
  status?: string;
  message?: string[];
  Results?: {
    series?: Array<{
      seriesID: string;
      data?: SeriesPoint[];
    }>;
  };
};

function parseArgs(): {
  lausOnly: boolean;
  qcewOnly: boolean;
  qcewYear: number | null;
} {
  const argv = process.argv.slice(2);
  const lausOnly = argv.includes("--laus-only");
  const qcewOnly = argv.includes("--qcew-only");
  let qcewYear: number | null = null;
  for (const a of argv) {
    if (a.startsWith("--qcew-year=")) {
      const n = Number(a.slice("--qcew-year=".length));
      if (Number.isFinite(n)) qcewYear = n;
    }
  }
  return { lausOnly, qcewOnly, qcewYear };
}

function parseSeriesMap(json: BlsResponse): Map<string, SeriesPoint[]> {
  const m = new Map<string, SeriesPoint[]>();
  for (const ser of json.Results?.series ?? []) {
    m.set(ser.seriesID, ser.data ?? []);
  }
  return m;
}

function valueAt(
  pts: SeriesPoint[] | undefined,
  year: number,
  month: number,
): number | null {
  if (!pts) return null;
  const period = `M${String(month).padStart(2, "0")}`;
  const hit = pts.find((d) => d.year === String(year) && d.period === period);
  if (!hit) return null;
  const v = Number(hit.value);
  return Number.isNaN(v) ? null : v;
}

function collectMonthKeys(seriesMaps: SeriesPoint[][]): {
  year: number;
  month: number;
}[] {
  const keySet = new Set<string>();
  for (const pts of seriesMaps) {
    for (const p of pts) {
      if (!p.period?.startsWith("M")) continue;
      keySet.add(`${p.year}|${p.period}`);
    }
  }
  return Array.from(keySet)
    .map((k) => {
      const [y, per] = k.split("|");
      return { year: Number(y), month: Number(per.slice(1)) };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

async function fetchBlsChunk(
  seriesIds: string[],
  apiKey: string,
  startYear: number,
  endYear: number,
): Promise<BlsResponse> {
  const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesid: seriesIds,
      registrationkey: apiKey,
      startyear: String(startYear),
      endyear: String(endYear),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`BLS HTTP ${res.status}: ${t.slice(0, 400)}`);
  }
  return (await res.json()) as BlsResponse;
}

async function syncLaus(
  sql: postgres.Sql,
  apiKey: string,
  importBatchId: string,
): Promise<void> {
  const counties = await sql<
    { id: string | number; county_fips: string; county_name: string }[]
  >`
    select id, county_fips, county_name from geo_counties where state_fips = ${STATE_FIPS}
    order by county_fips
  `;

  if (counties.length !== AR_COUNTIES_EXPECTED) {
    console.warn(
      `Expected ${AR_COUNTIES_EXPECTED} Arkansas counties in geo_counties, found ${counties.length}.`,
    );
  }

  const seriesByCounty = new Map<
    number,
    Record<LausCountyMeasureKey, string>
  >();
  const allSeries: string[] = [];

  for (const c of counties) {
    const ids = lausCountySeriesIds(STATE_FIPS, c.county_fips);
    seriesByCounty.set(Number(c.id), ids);
    allSeries.push(
      ids.unemployment_rate,
      ids.unemployment,
      ids.employment,
      ids.labor_force,
    );
  }

  const endYear = new Date().getFullYear();
  const startYear = endYear - 3;

  const merged = new Map<string, SeriesPoint[]>();
  const chunkSize = 48;
  for (let i = 0; i < allSeries.length; i += chunkSize) {
    const chunk = allSeries.slice(i, i + chunkSize);
    const json = await fetchBlsChunk(chunk, apiKey, startYear, endYear);
    if (json.status && json.status !== "REQUEST_SUCCEEDED") {
      console.warn("BLS status:", json.status, json.message?.join?.("; ") ?? "");
    }
    for (const [sid, pts] of Array.from(parseSeriesMap(json).entries())) {
      merged.set(sid, pts);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  let upserted = 0;
  for (const c of counties) {
    const countyId = Number(c.id);
    const ids = seriesByCounty.get(countyId);
    if (!ids) continue;

    const ratePts = merged.get(ids.unemployment_rate) ?? [];
    const unPts = merged.get(ids.unemployment) ?? [];
    const emPts = merged.get(ids.employment) ?? [];
    const lfPts = merged.get(ids.labor_force) ?? [];

    const months = collectMonthKeys([ratePts, unPts, emPts, lfPts]);
    if (!months.length) {
      console.error(
        `[LAUS] No monthly data for county ${c.county_name} (id=${countyId}, FIPS ${STATE_FIPS}${c.county_fips}).`,
      );
      continue;
    }

    for (const { year, month } of months) {
      const unemployment_rate = valueAt(ratePts, year, month);
      const unemployment = valueAt(unPts, year, month);
      const employment = valueAt(emPts, year, month);
      const labor_force = valueAt(lfPts, year, month);

      const lf = labor_force !== null ? Math.round(labor_force) : null;
      const em = employment !== null ? Math.round(employment) : null;
      const un = unemployment !== null ? Math.round(unemployment) : null;

      await sql`
        insert into bls_laus_county (
          county_id, source_year, source_month,
          labor_force, employment, unemployment, unemployment_rate,
          series_ids, data_source, import_batch_id
        )
        values (
          ${countyId}, ${year}, ${month},
          ${lf}, ${em}, ${un}, ${unemployment_rate},
          ${sql.json(ids)}, ${DATA_SOURCE_LAUS}, ${importBatchId}::uuid
        )
        on conflict (county_id, source_year, source_month) do update set
          labor_force = excluded.labor_force,
          employment = excluded.employment,
          unemployment = excluded.unemployment,
          unemployment_rate = excluded.unemployment_rate,
          series_ids = excluded.series_ids,
          data_source = excluded.data_source,
          import_batch_id = excluded.import_batch_id,
          updated_at = now()
      `;
      upserted++;
    }
  }

  console.log(`BLS LAUS: upserted ${upserted} county-month rows (batch ${importBatchId}).`);

  const latestRows = await sql<
    { y: number | null; m: number | null; n: string | number }[]
  >`
    with latest as (
      select max(source_year * 100 + source_month) as yymm
      from bls_laus_county
    )
    select
      case when latest.yymm is null then null
           else (latest.yymm / 100)::int end as y,
      case when latest.yymm is null then null
           else (latest.yymm % 100)::int end as m,
      count(distinct l.county_id)::bigint as n
    from latest
    left join bls_laus_county l
      on l.source_year * 100 + l.source_month = latest.yymm
    group by latest.yymm
  `;
  const { y, m, n } = latestRows[0] ?? { y: null, m: null, n: 0 };

  if (y != null && m != null) {
    const missing = await sql<{ county_name: string; county_fips: string }[]>`
      select g.county_name, g.county_fips
      from geo_counties g
      where g.state_fips = ${STATE_FIPS}
        and not exists (
          select 1 from bls_laus_county l
          where l.county_id = g.id
            and l.source_year = ${y}
            and l.source_month = ${m}
        )
      order by g.county_fips
    `;
    if (missing.length > 0) {
      console.error(
        `[LAUS] Validation failed: ${missing.length} counties missing data for latest period ${y}-${String(m).padStart(2, "0")}:`,
      );
      for (const row of missing) {
        console.error(`  - ${row.county_name} (${STATE_FIPS}${row.county_fips})`);
      }
      throw new Error("LAUS coverage incomplete for latest month.");
    }
    console.log(
      `[LAUS] Latest period ${y}-${String(m).padStart(2, "0")}: ${Number(n)} counties (expected ${AR_COUNTIES_EXPECTED}).`,
    );
  }
}

function resolveQcewYear(requested: number | null): number {
  if (requested != null && Number.isFinite(requested)) return requested;
  return new Date().getFullYear() - 1;
}

async function fetchQcewCsv(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "peoplebase-app/1.0 (BLS QCEW sync)" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}: ${t.slice(0, 200)}`);
  }
  return res.text();
}

async function syncQcew(
  sql: postgres.Sql,
  importBatchId: string,
  yearArg: number | null,
): Promise<void> {
  let year = resolveQcewYear(yearArg);
  const counties = await sql<
    { id: string | number; county_fips: string; county_name: string }[]
  >`
    select id, county_fips, county_name from geo_counties where state_fips = ${STATE_FIPS}
    order by county_fips
  `;

  for (let attempt = 0; attempt < 3; attempt++) {
    let ok = 0;
    for (const c of counties) {
      const areaFips = `${STATE_FIPS}${c.county_fips}`;
      const url = qcewAnnualAreaCsvUrl(year, areaFips);
      let text: string;
      try {
        text = await fetchQcewCsv(url);
      } catch (e) {
        console.warn(`[QCEW] ${c.county_name} (${areaFips}) ${year}: ${e}`);
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }

      const rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
      }) as Record<string, string>[];

      const row = rows.find(
        (r) =>
          r.own_code === QCEW_COUNTY_TOTAL_OWNERSHIP &&
          r.industry_code === QCEW_COUNTY_TOTAL_INDUSTRY &&
          r.qtr === "A",
      );

      if (!row) {
        console.error(
          `[QCEW] No total row (own=0, industry=10, qtr=A) for ${c.county_name} (${areaFips}) year ${year}.`,
        );
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }

      if (row.area_fips !== areaFips) {
        console.error(
          `[QCEW] area_fips mismatch: expected ${areaFips}, got ${row.area_fips} (${c.county_name}).`,
        );
        throw new Error("QCEW area_fips mismatch — aborting.");
      }

      const establishments = row.annual_avg_estabs
        ? Number(row.annual_avg_estabs)
        : null;
      const employment = row.annual_avg_emplvl
        ? Number(row.annual_avg_emplvl)
        : null;
      const totalAnnualWages: string | null =
        row.total_annual_wages != null && String(row.total_annual_wages).trim() !== ""
          ? String(row.total_annual_wages).replace(/,/g, "")
          : null;
      const averageWeeklyWage = row.annual_avg_wkly_wage
        ? Number(row.annual_avg_wkly_wage)
        : null;

      const countyId = Number(c.id);
      const sourceRef = url;

      await sql`
        insert into bls_qcew_county (
          county_id, source_year, qtr,
          ownership_code, industry_code,
          establishments, employment, total_annual_wages, average_weekly_wage,
          source_reference, data_source, import_batch_id
        )
        values (
          ${countyId}, ${year}, ${"A"},
          ${QCEW_COUNTY_TOTAL_OWNERSHIP}, ${QCEW_COUNTY_TOTAL_INDUSTRY},
          ${establishments}, ${employment}, ${totalAnnualWages}, ${averageWeeklyWage},
          ${sourceRef}, ${DATA_SOURCE_QCEW}, ${importBatchId}::uuid
        )
        on conflict (county_id, source_year, qtr, ownership_code, industry_code) do update set
          establishments = excluded.establishments,
          employment = excluded.employment,
          total_annual_wages = excluded.total_annual_wages,
          average_weekly_wage = excluded.average_weekly_wage,
          source_reference = excluded.source_reference,
          data_source = excluded.data_source,
          import_batch_id = excluded.import_batch_id,
          updated_at = now()
      `;
      ok++;
      await new Promise((r) => setTimeout(r, 120));
    }

    if (ok === counties.length) {
      console.log(
        `BLS QCEW: loaded annual totals for ${ok} counties (${year}, batch ${importBatchId}).`,
      );
      return;
    }

    console.warn(
      `[QCEW] Only ${ok}/${counties.length} counties for year ${year}; retrying prior year.`,
    );
    year -= 1;
  }

  throw new Error("QCEW sync failed after retries.");
}

async function main(): Promise<void> {
  const { lausOnly, qcewOnly, qcewYear } = parseArgs();
  if (lausOnly && qcewOnly) {
    throw new Error("Use only one of --laus-only or --qcew-only.");
  }

  const dbUrl = requireDatabaseUrl();
  const sql = postgres(dbUrl, { ssl: "require", max: 3 });
  const importBatchId = randomUUID();

  try {
    if (!qcewOnly) {
      const apiKey = requireBlsApiKey();
      await syncLaus(sql, apiKey, importBatchId);
    }
    if (!lausOnly) {
      await syncQcew(sql, importBatchId, qcewYear);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
