/**
 * Validates Arkansas county seed and optional raw_vr county name coverage.
 * Usage: npx tsx scripts/validate-geography.ts
 */
import "./_dotenv-path";
import "dotenv/config";

import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

const EXPECTED_AR_COUNTIES = 75;

async function main() {
  const url = requireDatabaseUrl();
  const sql = postgres(url, { ssl: "require", max: 1 });

  try {
    const [{ n }] = await sql<[{ n: string | number }]>`
      select count(*)::bigint as n from geo_counties where state_fips = '05'
    `;
    const count = Number(n);
    if (count !== EXPECTED_AR_COUNTIES) {
      console.error(
        `Expected ${EXPECTED_AR_COUNTIES} Arkansas counties in geo_counties, found ${count}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`geo_counties: ${count} Arkansas rows OK`);
    }

    const vrCols = await sql<[{ column_name: string }]>`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'raw_vr'
    `;
    const colSet = new Set(vrCols.map((r) => r.column_name));
    const countyCol = colSet.has("County")
      ? "County"
      : colSet.has("county")
        ? "county"
        : null;

    if (countyCol) {
      const q = `"${countyCol.replace(/"/g, '""')}"`;
      const orphans = await sql.unsafe<
        { raw_county: string | null; c: string | number }[]
      >(`
        select trim(${q}::text) as raw_county, count(*)::bigint as c
        from raw_vr
        where ${q} is not null
          and trim(${q}::text) <> ''
        group by 1
        having not exists (
          select 1 from geo_county_aliases a
          where a.source_system = 'raw_vr'
            and a.normalized_raw_name = normalize_geo_name(trim(raw_county))
        )
        and not exists (
          select 1 from geo_counties g
          where g.normalized_county_name = normalize_geo_name(trim(raw_county))
        )
        order by c desc
        limit 25
      `);

      if (orphans.length > 0) {
        console.warn("Top raw_vr county values with no geo_counties name match:");
        for (const row of orphans) {
          console.warn(`  "${row.raw_county}" (${row.c} rows)`);
        }
      } else {
        console.log(
          "raw_vr county names: all sampled groups map via normalize_geo_name / geo_county_aliases (top 25 orphans none)",
        );
      }
    } else {
      console.log("raw_vr: no County/county column; skip name match check");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
