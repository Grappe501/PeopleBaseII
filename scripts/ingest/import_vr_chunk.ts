import "../_dotenv-path";
import "dotenv/config";

import fs from "fs";
import csv from "csv-parser";
import postgres from "postgres";
import path from "path";
import { requireDatabaseUrl } from "@/lib/env";

const sql = postgres(requireDatabaseUrl(), {
  ssl: "require",
});

const FILE_PATH = path.resolve("data/chunks/vr/vr_part_001.csv");
const BATCH_SIZE = 1000;

async function run() {
  const rows: any[] = [];
  let total = 0;

  const stream = fs.createReadStream(FILE_PATH).pipe(csv());

  for await (const row of stream) {
    rows.push(row);

    if (rows.length >= BATCH_SIZE) {
      await insertBatch(rows);
      total += rows.length;
      console.log(`Inserted ${total} rows`);
      rows.length = 0;
    }
  }

  if (rows.length > 0) {
    await insertBatch(rows);
    total += rows.length;
  }

  console.log(`Done. Total inserted: ${total}`);
}

async function insertBatch(rows: any[]) {
  const values = rows.map((r) => ({
    county: r.County,
    key_registrant: r.KEY_REGISTRANT,
    voter_id: r.VoterID,
    registrant_status: r.CDE_REGISTRANT_STATUS,
    registrant_reason: r.CDE_REGISTRANT_REASON,
    date_of_birth: r.date_of_birth,
    name_last: r.TEXT_NAME_LAST,
    name_first: r.TEXT_NAME_FIRST,
    res_city: r.TEXT_RES_CITY,
    res_state: r.CDE_RES_STATE,
    res_zip5: r.TEXT_RES_ZIP5,
    precinct_name: r.PrecinctName,
    party: r.CDE_PARTY,
    congressional_district: r.CongressionalDistrict,
    source_file_name: "vr_part_001.csv",
    import_batch: "batch_001"
  }));

  await sql`
    insert into raw_vr ${sql(values)}
  `;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
