import "../_dotenv-path";
import "dotenv/config";

import fs from "fs";
import path from "node:path";
import csv from "csv-parser";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

const sql = postgres(requireDatabaseUrl(), {
  ssl: "require",
});

const BATCH_SIZE = 1000;
const LOG_EVERY = 10_000;

type CliArgs = {
  filePath: string;
  limit: number | null;
  importBatch: string;
  importBatchProvided: boolean;
  truncateFirst: boolean;
  yes: boolean;
  skipIfExists: boolean;
  force: boolean;
};

function formatTimestampForBatch(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function safeBasenameForBatch(filePath: string): string {
  const base = path.basename(filePath);
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function parseIntArg(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid ${name}: expected a non-negative integer, got "${value}"`);
  }
  return n;
}

function parseArgs(argv: string[]): CliArgs {
  const defaultFile = path.resolve("data/vr.csv");

  let filePath = defaultFile;
  let limit: number | null = null;
  let importBatchRaw: string | null = null;
  let importBatchProvided = false;
  let truncateFirst = false;
  let yes = false;
  let skipIfExists = false;
  let force = false;

  for (const a of argv) {
    if (a === "--truncate-first") {
      truncateFirst = true;
      continue;
    }
    if (a === "--yes") {
      yes = true;
      continue;
    }
    if (a === "--skip-if-exists") {
      skipIfExists = true;
      continue;
    }
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a.startsWith("--file=")) {
      filePath = path.resolve(a.slice("--file=".length));
      continue;
    }
    if (a.startsWith("--limit=")) {
      limit = parseIntArg("--limit", a.slice("--limit=".length));
      continue;
    }
    if (a.startsWith("--import-batch=")) {
      importBatchRaw = a.slice("--import-batch=".length).trim();
      importBatchProvided = true;
      continue;
    }
    if (a === "--help" || a === "-h") {
      console.log(
        [
          "VR ingestion loader (raw_vr normalized insert).",
          "",
          "Usage:",
          "  npm run ingest:vr -- [--file=PATH] [--limit=N] [--import-batch=NAME] [--skip-if-exists] [--force] [--truncate-first --yes]",
          "",
          "Flags:",
          "  --file=PATH           Override input file (default: data/vr.csv)",
          "  --limit=N             Stop after inserting N rows (safe for tests)",
          "  --import-batch=NAME   Tag every inserted row with raw_vr.import_batch",
          "  --skip-if-exists      If raw_vr already has rows for this source_file_name or import_batch, exit without importing",
          "  --force               Override --skip-if-exists and proceed anyway",
          "  --truncate-first      TRUNCATE raw_vr before import (requires --yes)",
          "  --yes                 Confirmation for destructive operations",
          "",
          "Examples:",
          "  npm run ingest:vr -- --limit=500 --import-batch=test_500",
          "  npm run ingest:vr -- --file=data/chunks/vr/vr_part_001.csv --import-batch=chunk001 --skip-if-exists",
          "  npm run ingest:vr -- --file=data/chunks/vr/vr_part_001.csv --import-batch=chunk001 --skip-if-exists --force",
          "  npm run ingest:vr -- --file=data/chunks/vr/vr_part_001.csv --limit=50000 --import-batch=chunk001_test",
          "  npm run ingest:vr -- --truncate-first --yes --import-batch=full_reload_20260408",
        ].join("\n"),
      );
      process.exit(0);
    }

    // Unknown args should fail fast (avoid silently ignoring typos)
    if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}. Use --help to see supported flags.`);
    }
  }

  const importBatch =
    importBatchRaw && importBatchRaw.length > 0
      ? importBatchRaw
      : `vr_${formatTimestampForBatch(new Date())}_${safeBasenameForBatch(filePath)}`;

  return {
    filePath,
    limit,
    importBatch,
    importBatchProvided,
    truncateFirst,
    yes,
    skipIfExists,
    force,
  };
}

type RawVrRow = {
  County?: string;
  KEY_REGISTRANT?: string;
  VoterID?: string;
  CDE_REGISTRANT_STATUS?: string;
  CDE_REGISTRANT_REASON?: string;
  date_of_birth?: string;
  date_of_registration?: string;
  TEXT_NAME_LAST?: string;
  TEXT_NAME_FIRST?: string;
  TEXT_NAME_MIDDLE?: string;
  CDE_NAME_SUFFIX?: string;
  TEXT_RES_ADDRESS_NBR?: string;
  TEXT_RES_ADDRESS_NBR_SUFFIX?: string;
  CDE_STREET_DIR_PREFIX?: string;
  TEXT_STREET_NAME?: string;
  DESC_STREET_TYPE?: string;
  CDE_STREET_DIR_SUFFIX?: string;
  DESC_UNIT_TYPE?: string;
  TEXT_RES_UNIT_NBR?: string;
  TEXT_RES_CITY?: string;
  CDE_RES_STATE?: string;
  TEXT_RES_ZIP5?: string;
  TEXT_RES_ZIP4?: string;
  PrecinctName?: string;
  CDE_PARTY?: string;
  date_of_party_affiliation?: string;
  TEXT_RES_PHYSICAL_ADDRESS?: string;
  CongressionalDistrict?: string;
  StateSenateDistrict?: string;
  StateRepresentativeDistrict?: string;
  DateLastVoted?: string;
};

function asTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = typeof value === "string" ? value : String(value);
  const trimmed = s.trim();
  return trimmed === "" ? null : trimmed;
}

const cleanText = asTrimmedString;
const cleanDate = asTrimmedString;

function mapRowToInsertValue(params: {
  row: RawVrRow;
  importBatch: string;
  sourceFileName: string;
}): Record<string, unknown> {
  const { row: r, importBatch, sourceFileName } = params;
  return {
    county: cleanText(r.County),
    key_registrant: cleanText(r.KEY_REGISTRANT),
    voter_id: cleanText(r.VoterID),
    registrant_status: cleanText(r.CDE_REGISTRANT_STATUS),
    registrant_reason: cleanText(r.CDE_REGISTRANT_REASON),
    date_of_birth: cleanDate(r.date_of_birth),
    date_of_registration: cleanDate(r.date_of_registration),
    name_last: cleanText(r.TEXT_NAME_LAST),
    name_first: cleanText(r.TEXT_NAME_FIRST),
    name_middle: cleanText(r.TEXT_NAME_MIDDLE),
    name_suffix: cleanText(r.CDE_NAME_SUFFIX),
    res_address_nbr: cleanText(r.TEXT_RES_ADDRESS_NBR),
    res_address_nbr_suffix: cleanText(r.TEXT_RES_ADDRESS_NBR_SUFFIX),
    street_dir_prefix: cleanText(r.CDE_STREET_DIR_PREFIX),
    street_name: cleanText(r.TEXT_STREET_NAME),
    street_type: cleanText(r.DESC_STREET_TYPE),
    street_dir_suffix: cleanText(r.CDE_STREET_DIR_SUFFIX),
    unit_type: cleanText(r.DESC_UNIT_TYPE),
    res_unit_nbr: cleanText(r.TEXT_RES_UNIT_NBR),
    res_city: cleanText(r.TEXT_RES_CITY),
    res_state: cleanText(r.CDE_RES_STATE),
    res_zip5: cleanText(r.TEXT_RES_ZIP5),
    res_zip4: cleanText(r.TEXT_RES_ZIP4),
    precinct_name: cleanText(r.PrecinctName),
    party: cleanText(r.CDE_PARTY),
    date_of_party_affiliation: cleanDate(r.date_of_party_affiliation),
    res_physical_address: cleanText(r.TEXT_RES_PHYSICAL_ADDRESS),
    congressional_district: cleanText(r.CongressionalDistrict),
    state_senate_district: cleanText(r.StateSenateDistrict),
    state_representative_district: cleanText(r.StateRepresentativeDistrict),
    date_last_voted: cleanDate(r.DateLastVoted),
    import_batch: importBatch,
    source_file_name: sourceFileName,
    imported_at: new Date().toISOString(),
  };
}

async function insertBatch(values: Record<string, unknown>[]) {
  if (!values.length) return;

  await sql`
    insert into raw_vr ${sql(values)}
  `;
}

type PreflightResult = {
  existingRowsForSourceFile: number;
  existingBatchesForSourceFile: string[];
  sourceFileCreatedAtMin: string | null;
  sourceFileCreatedAtMax: string | null;
  sourceFileImportedAtMin: string | null;
  sourceFileImportedAtMax: string | null;
  existingRowsForImportBatch: number | null;
};

async function preflightExistingLoads(params: {
  sourceFileName: string;
  importBatch: string;
  importBatchProvided: boolean;
}): Promise<PreflightResult> {
  const { sourceFileName, importBatch, importBatchProvided } = params;

  const [srcCount, srcBatches, srcMinMax] = await Promise.all([
    sql<[{ n: string | number }]>`
      select count(*)::bigint as n
      from raw_vr
      where source_file_name = ${sourceFileName}
    `,
    sql<[{ import_batch: string | null }]>`
      select distinct import_batch
      from raw_vr
      where source_file_name = ${sourceFileName}
      order by import_batch nulls last
      limit 50
    `,
    sql<
      [{ created_min: string | null; created_max: string | null; imported_min: string | null; imported_max: string | null }]
    >`
      select
        min(created_at)::text as created_min,
        max(created_at)::text as created_max,
        min(imported_at)::text as imported_min,
        max(imported_at)::text as imported_max
      from raw_vr
      where source_file_name = ${sourceFileName}
    `,
  ]);

  let existingRowsForImportBatch: number | null = null;
  if (importBatchProvided) {
    const batchCount = await sql<[{ n: string | number }]>`
      select count(*)::bigint as n
      from raw_vr
      where import_batch = ${importBatch}
    `;
    existingRowsForImportBatch = Number(batchCount[0]?.n ?? 0);
  }

  return {
    existingRowsForSourceFile: Number(srcCount[0]?.n ?? 0),
    existingBatchesForSourceFile: (srcBatches ?? [])
      .map((r) => r.import_batch)
      .filter((v): v is string => typeof v === "string" && v.trim() !== ""),
    sourceFileCreatedAtMin: srcMinMax[0]?.created_min ?? null,
    sourceFileCreatedAtMax: srcMinMax[0]?.created_max ?? null,
    sourceFileImportedAtMin: srcMinMax[0]?.imported_min ?? null,
    sourceFileImportedAtMax: srcMinMax[0]?.imported_max ?? null,
    existingRowsForImportBatch,
  };
}

async function run() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));

  const resolvedPath = args.filePath;
  const sourceFileName = path.basename(resolvedPath);

  let fileSizeBytes: number | null = null;
  let fileMtimeIso: string | null = null;
  try {
    const st = await fs.promises.stat(resolvedPath);
    fileSizeBytes = st.size;
    fileMtimeIso = st.mtime ? st.mtime.toISOString() : null;
  } catch {
    // will fail later when attempting to open stream; keep preflight readable
  }

  console.log("[vr_ingest] Preflight");
  console.log("  file:", resolvedPath);
  console.log("  file_basename:", sourceFileName);
  console.log("  file_size_bytes:", fileSizeBytes ?? "(unavailable)");
  console.log("  file_mtime:", fileMtimeIso ?? "(unavailable)");
  console.log("  DATABASE_URL present?:", "yes"); // requireDatabaseUrl already enforced at module init
  console.log("  limit:", args.limit ?? "(none)");
  console.log("  import_batch:", args.importBatch);
  console.log("  import_batch_provided:", args.importBatchProvided ? "yes" : "no");
  console.log("  truncate_first:", args.truncateFirst ? "yes" : "no");
  console.log("  yes:", args.yes ? "yes" : "no");
  console.log("  skip_if_exists:", args.skipIfExists ? "yes" : "no");
  console.log("  force:", args.force ? "yes" : "no");

  // Read-only preflight DB checks (do not write before this point)
  const existing = await preflightExistingLoads({
    sourceFileName,
    importBatch: args.importBatch,
    importBatchProvided: args.importBatchProvided,
  });
  console.log("[vr_ingest] Existing load check (read-only)");
  console.log("  existing_rows_for_source_file:", existing.existingRowsForSourceFile);
  console.log(
    "  existing_rows_for_import_batch:",
    existing.existingRowsForImportBatch === null
      ? "(skipped; --import-batch not provided)"
      : existing.existingRowsForImportBatch,
  );
  console.log(
    "  existing_import_batches_for_source_file:",
    existing.existingBatchesForSourceFile.length
      ? existing.existingBatchesForSourceFile.join(", ")
      : "(none)",
  );
  console.log("  source_file_created_at_min:", existing.sourceFileCreatedAtMin ?? "(null)");
  console.log("  source_file_created_at_max:", existing.sourceFileCreatedAtMax ?? "(null)");
  console.log("  source_file_imported_at_min:", existing.sourceFileImportedAtMin ?? "(null)");
  console.log("  source_file_imported_at_max:", existing.sourceFileImportedAtMax ?? "(null)");

  const likelyAlreadyLoaded =
    existing.existingRowsForSourceFile > 0 ||
    (existing.existingRowsForImportBatch !== null &&
      existing.existingRowsForImportBatch > 0);
  if (likelyAlreadyLoaded) {
    console.warn(
      "[vr_ingest] WARNING: this file/batch looks like it may already be loaded in raw_vr.",
    );
  }

  if (args.skipIfExists && !args.force && likelyAlreadyLoaded) {
    if (args.truncateFirst) {
      console.warn(
        "[vr_ingest] NOTE: --skip-if-exists would skip, but --truncate-first is enabled. Proceeding because you are explicitly doing a clean reload.",
      );
    } else {
      console.log(
        "[vr_ingest] Skipping import due to --skip-if-exists (use --force to override).",
      );
      process.exit(0);
    }
  }

  if (args.truncateFirst) {
    if (!args.yes) {
      throw new Error(
        [
          "Refusing to truncate raw_vr without explicit confirmation.",
          "You passed --truncate-first but did not pass --yes.",
          "Re-run with: --truncate-first --yes",
        ].join(" "),
      );
    }
    console.warn(
      "[vr_ingest] WARNING: truncating public.raw_vr (destructive). This will remove all VR rows before re-import.",
    );
    await sql`truncate table raw_vr`;
    console.log("[vr_ingest] Truncate complete.");
  }

  const buffered: Record<string, unknown>[] = [];
  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let batchNumber = 0;

  const stream = fs.createReadStream(resolvedPath).pipe(csv());

  for await (const raw of stream) {
    const rowNumber = processed + 1;
    if (args.limit !== null && processed >= args.limit) {
      break;
    }

    processed++;

    try {
      const value = mapRowToInsertValue({
        row: raw as RawVrRow,
        importBatch: args.importBatch,
        sourceFileName,
      });
      buffered.push(value);
    } catch (e) {
      failed++;
      if (failed <= 5) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[vr_ingest] Row map failed at row=${rowNumber}: ${msg}`);
        console.error("[vr_ingest] Row sample keys:", Object.keys(raw ?? {}).slice(0, 30));
      }
      continue;
    }

    if (buffered.length >= BATCH_SIZE) {
      batchNumber++;
      try {
        await insertBatch(buffered);
        inserted += buffered.length;
      } catch (e) {
        // DB-level errors should fail fast to avoid unknown partial states.
        console.error(
          `[vr_ingest] DB insert failed in batch=${batchNumber} (buffer=${buffered.length}) after processed=${processed}, inserted=${inserted}.`,
        );
        throw e;
      } finally {
        buffered.length = 0;
      }
    }

    if (processed % LOG_EVERY === 0) {
      const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
      const rate = Math.round(processed / elapsedSec);
      console.log(
        `[vr_ingest] progress processed=${processed} inserted=${inserted} skipped=${skipped} failed=${failed} elapsed_sec=${elapsedSec.toFixed(1)} rate_rows_per_sec=${rate}`,
      );
    }
  }

  if (buffered.length > 0) {
    batchNumber++;
    try {
      await insertBatch(buffered);
      inserted += buffered.length;
    } catch (e) {
      console.error(
        `[vr_ingest] DB insert failed in final batch=${batchNumber} (buffer=${buffered.length}) after processed=${processed}, inserted=${inserted}.`,
      );
      throw e;
    } finally {
      buffered.length = 0;
    }
  }

  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
  console.log("[vr_ingest] Complete");
  console.log("  import_batch:", args.importBatch);
  console.log("  processed:", processed);
  console.log("  inserted:", inserted);
  console.log("  skipped:", skipped);
  console.log("  failed:", failed);
  console.log("  elapsed_sec:", elapsedSec.toFixed(2));
  console.log("  avg_rows_per_sec:", Math.round(inserted / elapsedSec));

  process.exit(0);
}

run().catch((error) => {
  console.error("VR import failed:", error);
  process.exit(1);
});
