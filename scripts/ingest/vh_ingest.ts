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
  const defaultFile = path.resolve("data/vh.csv");

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
          "VH ingestion loader (raw_vh: wide voter-history CSV).",
          "",
          "Usage:",
          "  npm run ingest:vh -- [--file=PATH] [--limit=N] [--import-batch=NAME] [--skip-if-exists] [--force] [--truncate-first --yes]",
          "",
          "Flags:",
          "  --file=PATH           Override input file (default: data/vh.csv)",
          "  --limit=N             Stop after inserting N rows (safe for tests)",
          "  --import-batch=NAME   Tag every inserted row with raw_vh.import_batch",
          "  --skip-if-exists      If raw_vh already has rows for this source_file_name or import_batch, exit without importing",
          "  --force               Override --skip-if-exists and proceed anyway",
          "  --truncate-first      TRUNCATE raw_vh before import (requires --yes)",
          "  --yes                 Confirmation for destructive operations",
          "",
          "Examples:",
          "  npm run ingest:vh -- --limit=500 --import-batch=test_500",
          "  npm run ingest:vh -- --file=data/chunks/vh/vh_part_001.csv --import-batch=vh_part_001 --skip-if-exists",
          "  npm run ingest:vh -- --file=data/chunks/vh/vh_part_001.csv --import-batch=vh_part_001 --skip-if-exists --force",
        ].join("\n"),
      );
      process.exit(0);
    }

    if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}. Use --help to see supported flags.`);
    }
  }

  const importBatch =
    importBatchRaw && importBatchRaw.length > 0
      ? importBatchRaw
      : `vh_${formatTimestampForBatch(new Date())}_${safeBasenameForBatch(filePath)}`;

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

function asTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = typeof value === "string" ? value : String(value);
  const trimmed = s.trim();
  return trimmed === "" ? null : trimmed;
}

const cleanText = asTrimmedString;

/** Full CSV row as string map for row_payload (preserves wide election columns). */
function rowToPlainObject(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === null) {
      out[k] = "";
    } else {
      out[k] = typeof v === "string" ? v : String(v);
    }
  }
  return out;
}

function mapRowToInsertValue(params: {
  row: Record<string, unknown>;
  importBatch: string;
  sourceFileName: string;
}): Record<string, unknown> {
  const { row: r, importBatch, sourceFileName } = params;

  function pick(...keys: string[]): string | null {
    for (const k of keys) {
      const v = cleanText(r[k]);
      if (v !== null) return v;
    }
    return null;
  }

  const plain = rowToPlainObject(r);

  return {
    key_registrant: pick("KEY_REGISTRANT", "key_registrant"),
    voter_id: pick("VoterID", "voter_id"),
    county: pick("County", "county"),
    election_date: pick("ElectionDate", "election_date"),
    election_type: pick("ElectionType", "election_type"),
    voting_method: pick("VotingMethod", "voting_method"),
    party_ballot: pick("Party", "PartyBallot", "party_ballot"),
    row_payload: plain,
    import_batch: importBatch,
    source_file_name: sourceFileName,
    imported_at: new Date().toISOString(),
  };
}

async function insertBatch(values: Record<string, unknown>[]) {
  if (!values.length) return;

  await sql`
    insert into raw_vh ${sql(values)}
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
      from raw_vh
      where source_file_name = ${sourceFileName}
    `,
    sql<[{ import_batch: string | null }]>`
      select distinct import_batch
      from raw_vh
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
      from raw_vh
      where source_file_name = ${sourceFileName}
    `,
  ]);

  let existingRowsForImportBatch: number | null = null;
  if (importBatchProvided) {
    const batchCount = await sql<[{ n: string | number }]>`
      select count(*)::bigint as n
      from raw_vh
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
    // will fail later when attempting to open stream
  }

  console.log("[vh_ingest] Preflight");
  console.log("  file:", resolvedPath);
  console.log("  file_basename:", sourceFileName);
  console.log("  file_size_bytes:", fileSizeBytes ?? "(unavailable)");
  console.log("  file_mtime:", fileMtimeIso ?? "(unavailable)");
  console.log("  DATABASE_URL present?:", "yes");
  console.log("  limit:", args.limit ?? "(none)");
  console.log("  import_batch:", args.importBatch);
  console.log("  import_batch_provided:", args.importBatchProvided ? "yes" : "no");
  console.log("  truncate_first:", args.truncateFirst ? "yes" : "no");
  console.log("  yes:", args.yes ? "yes" : "no");
  console.log("  skip_if_exists:", args.skipIfExists ? "yes" : "no");
  console.log("  force:", args.force ? "yes" : "no");

  const existing = await preflightExistingLoads({
    sourceFileName,
    importBatch: args.importBatch,
    importBatchProvided: args.importBatchProvided,
  });
  console.log("[vh_ingest] Existing load check (read-only)");
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
      "[vh_ingest] WARNING: this file/batch looks like it may already be loaded in raw_vh.",
    );
  }

  if (args.skipIfExists && !args.force && likelyAlreadyLoaded) {
    if (args.truncateFirst) {
      console.warn(
        "[vh_ingest] NOTE: --skip-if-exists would skip, but --truncate-first is enabled. Proceeding because you are explicitly doing a clean reload.",
      );
    } else {
      console.log(
        "[vh_ingest] Skipping import due to --skip-if-exists (use --force to override).",
      );
      process.exit(0);
    }
  }

  if (args.truncateFirst) {
    if (!args.yes) {
      throw new Error(
        [
          "Refusing to truncate raw_vh without explicit confirmation.",
          "You passed --truncate-first but did not pass --yes.",
          "Re-run with: --truncate-first --yes",
        ].join(" "),
      );
    }
    console.warn(
      "[vh_ingest] WARNING: truncating public.raw_vh (destructive). This will remove all VH rows before re-import.",
    );
    await sql`truncate table raw_vh`;
    console.log("[vh_ingest] Truncate complete.");
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
        row: raw as Record<string, unknown>,
        importBatch: args.importBatch,
        sourceFileName,
      });
      buffered.push(value);
    } catch (e) {
      failed++;
      if (failed <= 5) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[vh_ingest] Row map failed at row=${rowNumber}: ${msg}`);
        console.error("[vh_ingest] Row sample keys:", Object.keys(raw ?? {}).slice(0, 30));
      }
      continue;
    }

    if (buffered.length >= BATCH_SIZE) {
      batchNumber++;
      try {
        await insertBatch(buffered);
        inserted += buffered.length;
      } catch (e) {
        console.error(
          `[vh_ingest] DB insert failed in batch=${batchNumber} (buffer=${buffered.length}) after processed=${processed}, inserted=${inserted}.`,
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
        `[vh_ingest] progress processed=${processed} inserted=${inserted} skipped=${skipped} failed=${failed} elapsed_sec=${elapsedSec.toFixed(1)} rate_rows_per_sec=${rate}`,
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
        `[vh_ingest] DB insert failed in final batch=${batchNumber} (buffer=${buffered.length}) after processed=${processed}, inserted=${inserted}.`,
      );
      throw e;
    } finally {
      buffered.length = 0;
    }
  }

  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
  console.log("[vh_ingest] Complete");
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
  console.error("VH import failed:", error);
  process.exit(1);
});
