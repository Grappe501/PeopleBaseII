import fs from "fs";
import csv from "csv-parser";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

const BATCH_SIZE = 1000;

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

function cleanText(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function cleanDate(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

async function insertBatch(rows: RawVrRow[]) {
  const values = rows.map((r) => ({
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
  }));

  await sql`
    insert into raw_vr ${sql(values)}
  `;
}

async function run() {
  const rows: RawVrRow[] = [];
  let total = 0;

  const stream = fs.createReadStream("data/vr.csv").pipe(csv());

  for await (const row of stream) {
    rows.push(row as RawVrRow);

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

  console.log(`VR import complete. Total rows inserted: ${total}`);
  process.exit(0);
}

run().catch((error) => {
  console.error("VR import failed:", error);
  process.exit(1);
});
