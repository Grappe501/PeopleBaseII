/**
 * Split voter history CSV into fixed-size chunks using RFC 4180–aware parsing.
 * Avoids naive line splitting so quoted fields, embedded commas, and multiline
 * records stay intact.
 */
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";

const INPUT_FILE = path.resolve("data/vh.csv");
const OUTPUT_DIR = path.resolve("data/chunks/vh");
const ROWS_PER_CHUNK = 50_000;

function rowToCsvLine(row: string[]): string {
  return stringify([row], {
    header: false,
    quoted: true,
    quoted_empty: true,
    delimiter: ",",
    escape: '"',
    quote: '"',
    eof: false,
    record_delimiter: "\n",
  }).replace(/\n$/, "");
}

function makeChunkFileName(partNumber: number): string {
  const padded = String(partNumber).padStart(3, "0");
  return path.join(OUTPUT_DIR, `vh_part_${padded}.csv`);
}

async function ensureOutputDir(): Promise<void> {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await fs.promises.readdir(OUTPUT_DIR);
  for (const name of existing) {
    if (/^vh_part_\d{3}\.csv$/.test(name)) {
      await fs.promises.unlink(path.join(OUTPUT_DIR, name));
    }
  }
}

async function splitVh(): Promise<void> {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  await ensureOutputDir();

  const parser = fs.createReadStream(INPUT_FILE).pipe(
    parse({
      columns: false,
      bom: true,
      relax_column_count: true,
      trim: false,
      skip_empty_lines: false,
    })
  );

  let header: string[] | null = null;
  let partNumber = 1;
  let rowCountInChunk = 0;
  let totalDataRows = 0;
  let writer: fs.WriteStream | null = null;

  function closeWriter(): void {
    if (writer) {
      writer.end();
      writer = null;
    }
  }

  function openNewChunk(): void {
    const filePath = makeChunkFileName(partNumber);
    const ws = fs.createWriteStream(filePath, { encoding: "utf8" });
    if (!header) {
      throw new Error("Header is missing before opening a chunk.");
    }
    ws.write(rowToCsvLine(header) + "\n");
    rowCountInChunk = 0;
    console.log(`Opened ${filePath}`);
    writer = ws;
  }

  for await (const record of parser) {
    const row = record as string[];
    if (header === null) {
      header = row;
      openNewChunk();
      continue;
    }

    if (!writer) {
      openNewChunk();
    }

    writer!.write(rowToCsvLine(row) + "\n");
    rowCountInChunk++;
    totalDataRows++;

    if (rowCountInChunk >= ROWS_PER_CHUNK) {
      closeWriter();
      console.log(
        `Finished chunk ${partNumber} with ${rowCountInChunk} data rows`
      );
      partNumber++;
      writer = null;
    }

    if (totalDataRows % 100_000 === 0) {
      console.log(`Processed ${totalDataRows} data rows so far...`);
    }
  }

  closeWriter();

  const parseStream = parser as unknown as {
    info?: {
      invalid_field_length?: number;
      lines?: number;
      records?: number;
    };
  };
  const info = parseStream.info;
  const invalidLen = info?.invalid_field_length ?? 0;
  const lines = info?.lines ?? 0;
  const records = info?.records ?? 0;

  console.log(`Done. Total data rows: ${totalDataRows}`);
  console.log(`Parser records (incl. header): ${records}`);
  console.log(`Parser logical lines: ${lines}`);
  if (invalidLen > 0) {
    console.warn(
      `Warning: ${invalidLen} rows had non-uniform column counts (relax_column_count).`
    );
  }

  const written = (await fs.promises.readdir(OUTPUT_DIR)).filter((n) =>
    /^vh_part_\d{3}\.csv$/.test(n)
  );
  console.log(`Chunk files written: ${written.length}`);
}

splitVh().catch((error) => {
  console.error("split_vh failed:", error);
  process.exit(1);
});
