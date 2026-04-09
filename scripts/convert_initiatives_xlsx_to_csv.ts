/**
 * Convert initiative .xlsx workbooks (first sheet only) to UTF-8 CSV in the same directory.
 * Output filenames are normalized by keyword rules (see resolveOutputCsvName).
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const DEFAULT_DIR = "data/initiatives";

function parseArgs(argv: string[]) {
  let dir = DEFAULT_DIR;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a.startsWith("--dir=")) {
      dir = a.slice("--dir=".length).trim();
      continue;
    }
    if (a === "--dir") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        dir = next;
        i++;
      }
      continue;
    }
  }
  return { dir, force };
}

/** Keyword order matches requirement: redistrict → marijuana/cannabis → casino → rank/choice */
function resolveOutputCsvName(basenameWithoutExt: string): string | null {
  const lower = basenameWithoutExt.toLowerCase();
  if (lower.includes("redistrict")) return "redistricting.csv";
  if (lower.includes("marijuana") || lower.includes("cannabis")) return "marijuana.csv";
  if (lower.includes("casino")) return "casino.csv";
  if (lower.includes("rank") || lower.includes("choice")) return "rcv.csv";
  return null;
}

function stripBom(text: string): string {
  return text.startsWith("\ufeff") ? text.slice(1) : text;
}

function rowCountFromSheet(worksheet: XLSX.WorkSheet): number {
  const ref = worksheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  return range.e.r - range.s.r + 1;
}

function main() {
  const { dir, force } = parseArgs(process.argv.slice(2));
  const absDir = path.resolve(process.cwd(), dir);

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    console.error(`[convert_initiatives] Not a directory: ${absDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(absDir);
  const xlsxFiles = entries.filter((n) => n.toLowerCase().endsWith(".xlsx")).sort();

  if (xlsxFiles.length === 0) {
    console.log(`[convert_initiatives] No .xlsx files in ${absDir}`);
    console.log("Conversion complete. Files ready for ingestion.");
    return;
  }

  for (const name of xlsxFiles) {
    const base = path.basename(name, path.extname(name));
    const outName = resolveOutputCsvName(base);
    if (!outName) {
      console.warn(
        `[convert_initiatives] SKIP (no keyword match → redistricting|marijuana|casino|rcv): ${name}`,
      );
      continue;
    }

    const inputPath = path.join(absDir, name);
    const outputPath = path.join(absDir, outName);

    if (!force && fs.existsSync(outputPath)) {
      console.log(`[convert_initiatives] SKIP (exists, use --force): ${inputPath} → ${outputPath}`);
      continue;
    }

    const buf = fs.readFileSync(inputPath);
    const workbook = XLSX.read(buf, { type: "buffer", cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (firstSheet === undefined) {
      console.warn(`[convert_initiatives] SKIP (no sheets): ${inputPath}`);
      continue;
    }

    const worksheet = workbook.Sheets[firstSheet];
    let csv = XLSX.utils.sheet_to_csv(worksheet);
    csv = stripBom(csv);

    fs.writeFileSync(outputPath, csv, { encoding: "utf8" });

    const rows = rowCountFromSheet(worksheet);
    console.log(
      `[convert_initiatives] ${inputPath} → ${outputPath} rows=${rows}`,
    );
  }

  console.log("Conversion complete. Files ready for ingestion.");
}

main();
