/**
 * Applies sql migrations in order against DATABASE_URL (from .env.local).
 * Uses a single connection; prefer direct Postgres (port 5432) over the pooler for DDL.
 *
 * Usage:
 *   npx tsx scripts/run-sql-migrations.ts
 *   npx tsx scripts/run-sql-migrations.ts --from 005   (only 005, 006 — for DBs that already have 001–004)
 */
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import postgres from "postgres";

const root = process.cwd();

dotenv.config({ path: path.join(root, ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrlStrict = (() => {
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in .env.local");
  }
  return databaseUrl;
})();

const ALL_FILES = [
  "001_geography_reference.sql",
  "002_census_tables.sql",
  "003_bls_tables.sql",
  "004_elections_tables.sql",
  "004_raw_vr.sql",
  "005_analytics_views.sql",
  "006_county_geo_normalization.sql",
  "008_geo_counties_ar_census_fips.sql",
  "009_raw_vh.sql",
  "010_voter_initiative_signatures.sql",
  "011_voter_initiative_signatures_normalize.sql",
  "012_election_results_ingestion.sql",
  "013_election_results_mixed_geography.sql",
  "014_bls_county_economics.sql",
  "015_cd2_county_master_view.sql",
  "016_poll_tables.sql",
  "017_poll_tables_rebuild.sql",
  "018_statewide_county_master_view.sql",
  "019_statewide_precinct_priority_view.sql",
  "020_county_detail_export.sql",
  "021_statewide_voter_reengagement_view.sql",
  "022_statewide_city_master_view.sql",
  "023_census_place_tables.sql",
  "024_geo_city_primary_county_assignment.sql",
  "025_events_calendar.sql",
  "026_events_approval_workflow.sql",
  "027_volunteer_os_tables.sql",
  "028_field_app_tables.sql",
  "029_cm_hub_workflows.sql",
  "030_cm_agent_onboarding.sql",
  "118_cd2_precinct_priority_view.sql",
  "119_cd2_dem_target_views.sql",
  "120_cd2_intelligence_layer.sql",
  "121_cd2_voter_scorecard.sql",
] as const;

function parseFromArg(): string | null {
  const i = process.argv.indexOf("--from");
  if (i === -1 || !process.argv[i + 1]) return null;
  return process.argv[i + 1]!.trim();
}

async function main(): Promise<void> {
  const from = parseFromArg();
  let files: readonly string[];
  if (from) {
    const idx = ALL_FILES.findIndex((f) => f.startsWith(from));
    if (idx === -1) {
      throw new Error(
        `--from ${from}: no file matches (expected prefix like 005 or 005_analytics)`,
      );
    }
    files = ALL_FILES.slice(idx);
    console.log(`Starting from ${files[0]} (${files.length} file(s)).`);
  } else {
    files = ALL_FILES;
  }
  const sql = postgres(databaseUrlStrict, {
    ssl: "require",
    max: 1,
    connect_timeout: 60,
    idle_timeout: 0,
  });

  try {
    for (const f of files as string[]) {
      const p = path.join(root, "sql", f);
      const body = await fs.readFile(p, "utf8");
      process.stdout.write(`Applying ${f}... `);
      await sql.unsafe(body);
      console.log("ok");
    }
    console.log("All migration files executed.");
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
