import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Missing DATABASE_URL");

  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    const objects = await sql<
      { schema_name: string; name: string; relkind: string }[]
    >`
      select n.nspname as schema_name, c.relname as name, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'geo_counties',
          'census_county_acs',
          'raw_vr',
          'raw_vr_county_mapped',
          'diagnostics_vr_mapping_coverage',
          'diagnostics_vr_unmatched_counties',
          'analytics_county_registration_gap',
          'analytics_county_power_profile'
        )
      order by c.relname
    `;
    console.log("Key objects present:");
    console.table(objects);

    const vrStats = await sql<
      {
        total_rows: string | number;
        distinct_counties: string | number;
        county_null_rows: string | number;
        imported_at_min: string | null;
        imported_at_max: string | null;
      }[]
    >`
      select
        count(*)::bigint as total_rows,
        count(distinct county)::bigint as distinct_counties,
        count(*) filter (where county is null or trim(county) = '')::bigint as county_null_rows,
        min(imported_at)::text as imported_at_min,
        max(imported_at)::text as imported_at_max
      from raw_vr
    `;
    console.log("raw_vr stats:", vrStats[0]);

    const cds = await sql<{ congressional_district: string | null; n: string | number }[]>`
      select nullif(trim(congressional_district), '') as congressional_district,
             count(*)::bigint as n
      from raw_vr
      group by 1
      order by n desc nulls last
      limit 25
    `;
    console.log("Top congressional_district values:");
    console.table(cds);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

