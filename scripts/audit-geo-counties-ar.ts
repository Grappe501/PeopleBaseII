/**
 * Read-only: list Arkansas geo_counties rows for audit vs sql/001 seed.
 * Usage: npx tsx scripts/audit-geo-counties-ar.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Missing DATABASE_URL");
  const sql = postgres(url, { ssl: "require", max: 1 });
  try {
    const rows = await sql<
      {
        id: string | number;
        state_fips: string;
        county_fips: string;
        county_name: string;
        county_key: string;
      }[]
    >`
      select id, state_fips, county_fips, county_name, county_key
      from geo_counties
      where state_fips = '05'
      order by county_fips
    `;
    console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
