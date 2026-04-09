import fs from "fs";
import path from "path";
import readline from "readline";

const INPUT_FILE = path.resolve("data/vr.csv");
const OUTPUT_DIR = path.resolve("data/chunks/vr");
const ROWS_PER_CHUNK = 50000;

async function ensureOutputDir() {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
}

function makeChunkFileName(partNumber: number) {
  const padded = String(partNumber).padStart(3, "0");
  return path.join(OUTPUT_DIR, `vr_part_${padded}.csv`);
}

async function splitVr() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  await ensureOutputDir();

  const inputStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity,
  });

  let header: string | null = null;
  let partNumber = 1;
  let rowCountInChunk = 0;
  let totalRows = 0;
  let writer: fs.WriteStream | null = null;

  function openNewChunk(): fs.WriteStream {
    const filePath = makeChunkFileName(partNumber);
    const ws = fs.createWriteStream(filePath, { encoding: "utf8" });

    if (!header) {
      throw new Error("Header is missing before opening first chunk.");
    }

    ws.write(header + "\n");
    rowCountInChunk = 0;
    console.log(`Opened ${filePath}`);
    writer = ws;
    return ws;
  }

  function closeCurrentChunk() {
    if (writer) {
      writer.end();
      writer = null;
    }
  }

  for await (const line of rl) {
    if (header === null) {
      header = line;
      writer = openNewChunk();
      continue;
    }

    let out: fs.WriteStream;
    if (writer) {
      out = writer;
    } else {
      out = openNewChunk();
    }
    writer = out;
    out.write(line + "\n");
    rowCountInChunk++;
    totalRows++;

    if (rowCountInChunk >= ROWS_PER_CHUNK) {
      closeCurrentChunk();
      console.log(
        `Finished chunk ${partNumber} with ${rowCountInChunk} data rows`
      );
      partNumber++;
    }

    if (totalRows % 100000 === 0) {
      console.log(`Processed ${totalRows} rows so far...`);
    }
  }

  closeCurrentChunk();

  console.log(`Done. Total data rows processed: ${totalRows}`);
  console.log(`Total chunk files created: ${partNumber}`);
}

splitVr().catch((error) => {
  console.error("split_vr failed:", error);
  process.exit(1);
});
