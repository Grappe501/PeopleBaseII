import "../_dotenv-path";
import "dotenv/config";

import fs from "fs";
import path from "node:path";
import csv from "csv-parser";
import { parse } from "csv-parse/sync";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env";

const sql = postgres(requireDatabaseUrl(), {
  ssl: "require",
});

const BATCH_SIZE = 1000;
const LOG_EVERY = 10_000;

/** Slugs expected for the four ballot initiatives (extend as needed). */
const KNOWN_INITIATIVES = [
  "redistricting",
  "marijuana",
  "casino",
  "ranked_choice",
] as const;

type KnownInitiative = (typeof KNOWN_INITIATIVES)[number];

type CliArgs = {
  filePath: string;
  initiative: KnownInitiative;
  limit: number | null;
  importBatch: string;
  importBatchProvided: boolean;
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

function parseInitiative(raw: string): KnownInitiative {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, KnownInitiative> = {
    redistricting: "redistricting",
    marijuana: "marijuana",
    cannabis: "marijuana",
    casino: "casino",
    casinos: "casino",
    ranked_choice: "ranked_choice",
    ranked_choice_voting: "ranked_choice",
    rcv: "ranked_choice",
  };
  const fromAlias = aliases[s];
  if (fromAlias) return fromAlias;
  if ((KNOWN_INITIATIVES as readonly string[]).includes(s)) {
    return s as KnownInitiative;
  }
  throw new Error(
    `Invalid --initiative="${raw}". Use one of: ${KNOWN_INITIATIVES.join(", ")} (aliases: rcv → ranked_choice, cannabis → marijuana).`,
  );
}

function parseArgs(argv: string[]): CliArgs {
  let filePath: string | null = null;
  let initiativeRaw: string | null = null;
  let limit: number | null = null;
  let importBatchRaw: string | null = null;
  let importBatchProvided = false;
  let skipIfExists = false;
  let force = false;

  for (const a of argv) {
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
    if (a.startsWith("--initiative=")) {
      initiativeRaw = a.slice("--initiative=".length);
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
          "Initiative signer loader → public.voter_initiative_signatures",
          "",
          "Imports only voter_id and/or key_registrant plus initiative, source_file_name, import_batch.",
          "If you only have Excel (e.g. Valid Signature Report), export/save as CSV with a header row first.",
          "",
          "Usage:",
          "  npm run ingest:initiative -- --file=PATH --initiative=SLUG [--import-batch=NAME] [--limit=N] [--skip-if-exists] [--force]",
          "",
          "Required:",
          "  --file=PATH           CSV export (must include VoterID / Registrant ID and/or KEY_REGISTRANT)",
          "  --initiative=SLUG     One of: redistricting | marijuana | casino | ranked_choice",
          "",
          "Optional:",
          "  --import-batch=NAME   Tag rows (default: auto from timestamp + file basename)",
          "  --limit=N             Stop after N data rows (testing)",
          "  --skip-if-exists      Exit 0 if this source file+initiative or import_batch already has rows",
          "  --force               Override --skip-if-exists",
          "",
          "Examples:",
          "  npm run ingest:initiative -- --file=data/initiatives/redistricting.csv --initiative=redistricting --import-batch=redist_2022 --skip-if-exists",
          "  npm run ingest:initiative -- --file=data/initiatives/rcv.csv --initiative=ranked_choice --limit=500 --import-batch=rcv_test",
        ].join("\n"),
      );
      process.exit(0);
    }

    if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}. Use --help to see supported flags.`);
    }
  }

  if (!filePath) {
    throw new Error('Missing required --file=PATH (see --help).');
  }
  if (!initiativeRaw) {
    throw new Error(`Missing required --initiative=... (one of: ${KNOWN_INITIATIVES.join(", ")}).`);
  }

  const initiative = parseInitiative(initiativeRaw);

  const importBatch =
    importBatchRaw && importBatchRaw.length > 0
      ? importBatchRaw
      : `init_${initiative}_${formatTimestampForBatch(new Date())}_${safeBasenameForBatch(filePath)}`;

  return {
    filePath,
    initiative,
    limit,
    importBatch,
    importBatchProvided,
    skipIfExists,
    force,
  };
}

function normalizeHeaderToken(h: string): string {
  return h.replace(/^\ufeff/, "").trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Read the first CSV record (header row) with RFC-aware parsing on an initial buffer.
 */
function readCsvHeaderCells(filePath: string): string[] {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(1_048_576);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const text = buf.subarray(0, n).toString("utf8");
    const rows = parse(text, {
      bom: true,
      columns: false,
      relax_column_count: true,
      relax_quotes: true,
      from_line: 1,
      to_line: 1,
    }) as string[][];
    if (!rows.length || !rows[0]?.length) {
      throw new Error("Could not parse CSV header row (empty or unreadable file).");
    }
    return rows[0]!;
  } finally {
    fs.closeSync(fd);
  }
}

/** Arkansas exports often label the state ID as "Registrant ID" → registrant_id. */
const VOTER_ID_ALIASES = new Set([
  "voterid",
  "voter_id",
  "voter_id_num",
  "registrant_id",
  "registrantid",
]);
const KEY_REG_ALIASES = new Set(["key_registrant", "key_registrant_id"]);

type HeaderInsight = {
  headers: string[];
  normalizedTokens: string[];
  hasVoterIdColumn: boolean;
  hasKeyRegistrantColumn: boolean;
  voterIdHeader: string | null;
  keyRegistrantHeader: string | null;
};

function analyzeHeaders(headers: string[]): HeaderInsight {
  const normalizedTokens = headers.map(normalizeHeaderToken);
  let voterIdHeader: string | null = null;
  let keyRegistrantHeader: string | null = null;

  for (let i = 0; i < headers.length; i++) {
    const tok = normalizedTokens[i]!;
    if (!voterIdHeader && VOTER_ID_ALIASES.has(tok)) {
      voterIdHeader = headers[i]!;
    }
    if (!keyRegistrantHeader && KEY_REG_ALIASES.has(tok)) {
      keyRegistrantHeader = headers[i]!;
    }
  }

  return {
    headers,
    normalizedTokens,
    hasVoterIdColumn: voterIdHeader !== null,
    hasKeyRegistrantColumn: keyRegistrantHeader !== null,
    voterIdHeader,
    keyRegistrantHeader,
  };
}

function asTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = typeof value === "string" ? value : String(value);
  const trimmed = s.trim();
  return trimmed === "" ? null : trimmed;
}

function pickFromRow(row: Record<string, unknown>, headerName: string | null): string | null {
  if (!headerName) return null;
  if (Object.prototype.hasOwnProperty.call(row, headerName)) {
    return asTrimmedString(row[headerName]);
  }
  return null;
}

/** Fallback: case-insensitive key match on row keys. */
function pickCaseInsensitive(row: Record<string, unknown>, ...tokens: string[]): string | null {
  const map = new Map<string, string>();
  for (const k of Object.keys(row)) {
    map.set(normalizeHeaderToken(k), k);
  }
  for (const t of tokens) {
    const orig = map.get(normalizeHeaderToken(t));
    if (orig) {
      const v = asTrimmedString(row[orig]);
      if (v !== null) return v;
    }
  }
  return null;
}

function mapRowToInsertValue(params: {
  row: Record<string, unknown>;
  insight: HeaderInsight;
  initiative: string;
  importBatch: string;
  sourceFileName: string;
}): Record<string, unknown> | null {
  const { row, insight, initiative, importBatch, sourceFileName } = params;

  const voterId =
    pickFromRow(row, insight.voterIdHeader) ??
    pickCaseInsensitive(
      row,
      "VoterID",
      "voter_id",
      "VoterId",
      "Registrant ID",
      "registrant_id",
    );
  const keyRegistrant =
    pickFromRow(row, insight.keyRegistrantHeader) ??
    pickCaseInsensitive(row, "KEY_REGISTRANT", "key_registrant", "Key_Registrant");

  if (voterId === null && keyRegistrant === null) {
    return null;
  }

  return {
    voter_id: voterId,
    key_registrant: keyRegistrant,
    initiative,
    source_file_name: sourceFileName,
    import_batch: importBatch,
  };
}

async function insertBatch(values: Record<string, unknown>[]) {
  if (!values.length) return;

  await sql`
    insert into public.voter_initiative_signatures ${sql(values)}
    on conflict (initiative, import_batch, (coalesce(voter_id, '')), (coalesce(key_registrant, ''))) do nothing
  `;
}

type PreflightResult = {
  existingRowsForSourceFileAndInitiative: number;
  existingBatchesForSourceFile: string[];
  sourceFileCreatedAtMin: string | null;
  sourceFileCreatedAtMax: string | null;
  existingRowsForImportBatch: number | null;
};

async function preflightExistingLoads(params: {
  sourceFileName: string;
  initiative: string;
  importBatch: string;
  importBatchProvided: boolean;
}): Promise<PreflightResult> {
  const { sourceFileName, initiative, importBatch, importBatchProvided } = params;

  const [srcCount, srcBatches, srcMinMax] = await Promise.all([
    sql<[{ n: string | number }]>`
      select count(*)::bigint as n
      from public.voter_initiative_signatures
      where source_file_name = ${sourceFileName}
        and initiative = ${initiative}
    `,
    sql<[{ import_batch: string | null }]>`
      select distinct import_batch
      from public.voter_initiative_signatures
      where source_file_name = ${sourceFileName}
        and initiative = ${initiative}
      order by import_batch nulls last
      limit 50
    `,
    sql<[{ created_min: string | null; created_max: string | null }]>`
      select
        min(created_at)::text as created_min,
        max(created_at)::text as created_max
      from public.voter_initiative_signatures
      where source_file_name = ${sourceFileName}
        and initiative = ${initiative}
    `,
  ]);

  let existingRowsForImportBatch: number | null = null;
  if (importBatchProvided) {
    const batchCount = await sql<[{ n: string | number }]>`
      select count(*)::bigint as n
      from public.voter_initiative_signatures
      where import_batch = ${importBatch}
    `;
    existingRowsForImportBatch = Number(batchCount[0]?.n ?? 0);
  }

  return {
    existingRowsForSourceFileAndInitiative: Number(srcCount[0]?.n ?? 0),
    existingBatchesForSourceFile: (srcBatches ?? [])
      .map((r) => r.import_batch)
      .filter((v): v is string => typeof v === "string" && v.trim() !== ""),
    sourceFileCreatedAtMin: srcMinMax[0]?.created_min ?? null,
    sourceFileCreatedAtMax: srcMinMax[0]?.created_max ?? null,
    existingRowsForImportBatch,
  };
}

async function run() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));

  const resolvedPath = args.filePath;
  const sourceFileName = path.basename(resolvedPath);

  await fs.promises.access(resolvedPath, fs.constants.R_OK);

  let fileSizeBytes: number | null = null;
  let fileMtimeIso: string | null = null;
  try {
    const st = await fs.promises.stat(resolvedPath);
    fileSizeBytes = st.size;
    fileMtimeIso = st.mtime ? st.mtime.toISOString() : null;
  } catch {
    // surfaced on stream open
  }

  const headerCells = readCsvHeaderCells(resolvedPath);
  const insight = analyzeHeaders(headerCells);

  console.log("[initiative_ingest] CSV structure (header row)");
  console.log("  columns:", insight.headers.length);
  console.log("  column_names:", insight.headers.join(" | "));
  console.log("  has_VoterID_column:", insight.hasVoterIdColumn ? "yes" : "no");
  console.log("  has_KEY_REGISTRANT_column:", insight.hasKeyRegistrantColumn ? "yes" : "no");
  if (!insight.hasVoterIdColumn && !insight.hasKeyRegistrantColumn) {
    throw new Error(
      [
        "Preflight failed: CSV must include at least one recognizable column for VoterID or KEY_REGISTRANT.",
        "Expected header tokens like VoterID / voter_id / Registrant ID or KEY_REGISTRANT / key_registrant.",
        `Got tokens: ${insight.normalizedTokens.join(", ")}`,
      ].join(" "),
    );
  }

  console.log("[initiative_ingest] Preflight");
  console.log("  file:", resolvedPath);
  console.log("  file_basename:", sourceFileName);
  console.log("  file_size_bytes:", fileSizeBytes ?? "(unavailable)");
  console.log("  file_mtime:", fileMtimeIso ?? "(unavailable)");
  console.log("  DATABASE_URL present?:", "yes");
  console.log("  initiative:", args.initiative);
  console.log("  limit:", args.limit ?? "(none)");
  console.log("  import_batch:", args.importBatch);
  console.log("  import_batch_provided:", args.importBatchProvided ? "yes" : "no");
  console.log("  skip_if_exists:", args.skipIfExists ? "yes" : "no");
  console.log("  force:", args.force ? "yes" : "no");

  const existing = await preflightExistingLoads({
    sourceFileName,
    initiative: args.initiative,
    importBatch: args.importBatch,
    importBatchProvided: args.importBatchProvided,
  });

  console.log("[initiative_ingest] Existing load check (read-only)");
  console.log(
    "  existing_rows_for_source_file_and_initiative:",
    existing.existingRowsForSourceFileAndInitiative,
  );
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

  const likelyAlreadyLoaded =
    existing.existingRowsForSourceFileAndInitiative > 0 ||
    (existing.existingRowsForImportBatch !== null && existing.existingRowsForImportBatch > 0);

  if (likelyAlreadyLoaded) {
    console.warn(
      "[initiative_ingest] WARNING: this file/batch looks like it may already be loaded in voter_initiative_signatures.",
    );
  }

  if (args.skipIfExists && !args.force && likelyAlreadyLoaded) {
    console.log(
      "[initiative_ingest] Skipping import due to --skip-if-exists (use --force to override).",
    );
    process.exit(0);
  }

  const buffered: Record<string, unknown>[] = [];
  let processed = 0;
  let insertedAttempt = 0;
  let skippedEmpty = 0;
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
        insight,
        initiative: args.initiative,
        importBatch: args.importBatch,
        sourceFileName,
      });
      if (value === null) {
        skippedEmpty++;
        continue;
      }
      buffered.push(value);
    } catch (e) {
      failed++;
      if (failed <= 5) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[initiative_ingest] Row map failed at row=${rowNumber}: ${msg}`);
      }
      continue;
    }

    if (buffered.length >= BATCH_SIZE) {
      batchNumber++;
      const n = buffered.length;
      try {
        await insertBatch(buffered);
        insertedAttempt += n;
      } catch (e) {
        console.error(
          `[initiative_ingest] DB insert failed in batch=${batchNumber} (buffer=${buffered.length}) after processed=${processed}.`,
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
        `[initiative_ingest] progress processed=${processed} rows_submitted=${insertedAttempt} skipped_empty=${skippedEmpty} failed=${failed} elapsed_sec=${elapsedSec.toFixed(1)} rate_rows_per_sec=${rate}`,
      );
    }
  }

  if (buffered.length > 0) {
    batchNumber++;
    const n = buffered.length;
    try {
      await insertBatch(buffered);
      insertedAttempt += n;
    } catch (e) {
      console.error(
        `[initiative_ingest] DB insert failed in final batch=${batchNumber} (buffer=${buffered.length}).`,
      );
      throw e;
    } finally {
      buffered.length = 0;
    }
  }

  const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
  console.log("[initiative_ingest] Complete");
  console.log("  initiative:", args.initiative);
  console.log("  import_batch:", args.importBatch);
  console.log("  processed_rows:", processed);
  console.log("  rows_submitted_to_insert:", insertedAttempt);
  console.log("  skipped_empty_link_fields:", skippedEmpty);
  console.log("  failed:", failed);
  console.log("  elapsed_sec:", elapsedSec.toFixed(2));
  console.log(
    "  note: actual new rows may be lower than rows_submitted_to_insert if duplicates existed (ON CONFLICT DO NOTHING).",
  );

  process.exit(0);
}

run().catch((error) => {
  console.error("Initiative import failed:", error);
  process.exit(1);
});
