import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

/**
 * Arkansas place-level ACS 5-year sync:
 * - Upserts geo_cities (state_fips + place_fips + city_name + city_key)
 * - Upserts census_place_acs keyed by (state_fips, place_fips, source_year)
 *
 * Env: DATABASE_URL, CENSUS_API_KEY
 * Optional: CENSUS_ACS_YEAR (default 2022)
 *
 * Run:
 *   npx tsx scripts/sync-census-places.ts
 */

import { randomBytes } from "node:crypto";
import postgres, { type Sql } from "postgres";

const STATE_FIPS = "05";
const DATA_SOURCE = "census_acs5" as const;

const censusApiKey = process.env.CENSUS_API_KEY?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

function mustEnv(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function newUuidV7(epochMs: number = Date.now()): string {
  const buf = Buffer.alloc(16);
  let ts = BigInt(epochMs);
  const mask = BigInt(0xff);
  for (let i = 5; i >= 0; i--) {
    buf[i] = Number(ts & mask);
    ts >>= BigInt(8);
  }
  const rand = randomBytes(10);
  rand.copy(buf, 6, 0, 10);
  buf[6] = (buf[6]! & 0x0f) | 0x70;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const h = buf.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const CENSUS_NULL_SENTINELS = new Set([
  "-666666666",
  "-666666666.0",
  "-888888888",
  "-888888888.0",
  "-555555555",
  "-333333333",
]);

function parseAcsNumber(raw: string | undefined, allowNegative = false): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (CENSUS_NULL_SENTINELS.has(raw.trim())) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (!allowNegative && n < 0) return null;
  return n;
}

function sumVars(row: Record<string, string | undefined>, keys: readonly string[]): number | null {
  let total = 0;
  let any = false;
  for (const k of keys) {
    const v = parseAcsNumber(row[k]);
    if (v !== null) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

function normalizeCityNameFromCensusName(name: string): string {
  // Census place NAME usually: "<Place>, Arkansas"
  return name.replace(/,\s*Arkansas\s*$/i, "").trim();
}

async function normalizeGeoName(sql: Sql, value: string): Promise<string> {
  const rows = await sql<{ k: string }[]>`
    select public.normalize_geo_name(${value}) as k
  `;
  return rows[0]?.k ?? "";
}

/** Male 18+ age buckets — table B01001 */
const B01001_MALE_18_PLUS = [
  "007", "008", "009", "010", "011", "012", "013", "014", "015", "016", "017", "018", "019",
  "020", "021", "022", "023", "024", "025",
].map((s) => `B01001_${s}E`);

/** Female 18+ age buckets — table B01001 */
const B01001_FEMALE_18_PLUS = [
  "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "041", "042", "043",
  "044", "045", "046", "047", "048", "049",
].map((s) => `B01001_${s}E`);

const B15003_BACHELORS_PLUS = ["022", "023", "024", "025"].map((s) => `B15003_${s}E`);

const ACS_PLACE_GET = [
  "NAME",
  "B01003_001E",
  "B02001_002E",
  "B02001_003E",
  "B02001_005E",
  "B03003_003E",
  "B19013_001E",
  "B17001_002E",
  "B25003_002E",
  "B25003_003E",
  ...B01001_MALE_18_PLUS,
  ...B01001_FEMALE_18_PLUS,
  ...B15003_BACHELORS_PLUS,
] as const;

type ApiRow = { [K in (typeof ACS_PLACE_GET)[number]]: string } & {
  state: string;
  place: string;
};

async function fetchAcsPlaces(params: {
  acsYear: number;
  apiKey: string;
}): Promise<ApiRow[]> {
  const u = new URL(`https://api.census.gov/data/${params.acsYear}/acs/acs5`);
  u.searchParams.set("get", ACS_PLACE_GET.join(","));
  u.searchParams.set("for", "place:*");
  u.searchParams.set("in", `state:${STATE_FIPS}`);
  u.searchParams.set("key", params.apiKey);

  const res = await fetch(u.toString());
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Census API non-JSON response. HTTP ${res.status}. First 300 chars: ${text.slice(0, 300)}`);
  }
  const payload = JSON.parse(text) as string[][];
  const header = payload[0];
  if (!header) return [];
  const expected = [...ACS_PLACE_GET, "state", "place"];
  if (header.length !== expected.length || !header.every((h, i) => h === expected[i])) {
    throw new Error(`Place ACS header mismatch.\nExpected: ${expected.join(",")}\nGot: ${header.join(",")}`);
  }
  return payload.slice(1).map((cells) => {
    const row = {} as ApiRow;
    expected.forEach((k, i) => {
      (row as any)[k] = cells[i] ?? "";
    });
    return row;
  });
}

function votingAgePopulationFromRow(row: ApiRow): number | null {
  const male = sumVars(row, B01001_MALE_18_PLUS);
  const female = sumVars(row, B01001_FEMALE_18_PLUS);
  if (male === null && female === null) return null;
  return (male ?? 0) + (female ?? 0);
}

function bachelorsOrHigherFromRow(row: ApiRow): number | null {
  return sumVars(row, B15003_BACHELORS_PLUS);
}

async function upsertGeoCity(sql: Sql, params: {
  stateFips: string;
  placeFips: string;
  cityName: string;
  cityKey: string;
}): Promise<number> {
  const rows = await sql<{ id: string | number }[]>`
    insert into public.geo_cities (state_fips, place_fips, city_name, city_key)
    values (${params.stateFips}, ${params.placeFips}, ${params.cityName}, ${params.cityKey})
    on conflict (state_fips, place_fips) do update set
      city_name = excluded.city_name,
      city_key = excluded.city_key,
      updated_at = now()
    returning id
  `;
  return Number(rows[0]!.id);
}

async function upsertPlaceAcs(sql: Sql, params: {
  geoCityId: number;
  stateFips: string;
  placeFips: string;
  sourceYear: number;
  importBatchId: string;
  facts: {
    totalPopulation: number | null;
    votingAgePopulation: number | null;
    whitePopulation: number | null;
    blackPopulation: number | null;
    hispanicPopulation: number | null;
    asianPopulation: number | null;
    medianHouseholdIncome: number | null;
    povertyPopulation: number | null;
    bachelorsOrHigher: number | null;
    ownerOccupiedHousing: number | null;
    renterOccupiedHousing: number | null;
  };
}): Promise<void> {
  const f = params.facts;
  await sql`
    insert into public.census_place_acs (
      geo_city_id,
      state_fips,
      place_fips,
      source_year,
      total_population,
      voting_age_population,
      white_population,
      black_population,
      hispanic_population,
      asian_population,
      median_household_income,
      poverty_population,
      bachelors_or_higher,
      owner_occupied_housing,
      renter_occupied_housing,
      data_source,
      import_batch_id
    ) values (
      ${params.geoCityId},
      ${params.stateFips},
      ${params.placeFips},
      ${params.sourceYear},
      ${f.totalPopulation},
      ${f.votingAgePopulation},
      ${f.whitePopulation},
      ${f.blackPopulation},
      ${f.hispanicPopulation},
      ${f.asianPopulation},
      ${f.medianHouseholdIncome},
      ${f.povertyPopulation},
      ${f.bachelorsOrHigher},
      ${f.ownerOccupiedHousing},
      ${f.renterOccupiedHousing},
      ${DATA_SOURCE},
      ${params.importBatchId}
    )
    on conflict (state_fips, place_fips, source_year) do update set
      geo_city_id = excluded.geo_city_id,
      total_population = excluded.total_population,
      voting_age_population = excluded.voting_age_population,
      white_population = excluded.white_population,
      black_population = excluded.black_population,
      hispanic_population = excluded.hispanic_population,
      asian_population = excluded.asian_population,
      median_household_income = excluded.median_household_income,
      poverty_population = excluded.poverty_population,
      bachelors_or_higher = excluded.bachelors_or_higher,
      owner_occupied_housing = excluded.owner_occupied_housing,
      renter_occupied_housing = excluded.renter_occupied_housing,
      data_source = excluded.data_source,
      import_batch_id = excluded.import_batch_id,
      updated_at = now()
  `;
}

async function main() {
  const apiKey = mustEnv("CENSUS_API_KEY", censusApiKey);
  const dbUrl = mustEnv("DATABASE_URL", databaseUrl);
  const acsYear = Number(process.env.CENSUS_ACS_YEAR ?? "2022");
  if (!Number.isFinite(acsYear) || acsYear < 2009) throw new Error("Invalid CENSUS_ACS_YEAR");

  const sql = postgres(dbUrl, { ssl: "require", max: 3 });
  const importBatchId = newUuidV7();

  let fetched = 0;
  let upsertedCities = 0;
  let upsertedFacts = 0;

  try {
    const rows = await fetchAcsPlaces({ acsYear, apiKey });
    fetched = rows.length;

    for (const r of rows) {
      const placeFips = String(r.place).trim().padStart(5, "0");
      const cityName = normalizeCityNameFromCensusName(String(r.NAME ?? "").trim());
      const cityKey = await normalizeGeoName(sql, cityName);

      const geoCityId = await upsertGeoCity(sql, {
        stateFips: STATE_FIPS,
        placeFips,
        cityName,
        cityKey,
      });
      upsertedCities++;

      const facts = {
        totalPopulation: parseAcsNumber(r.B01003_001E),
        votingAgePopulation: votingAgePopulationFromRow(r),
        whitePopulation: parseAcsNumber(r.B02001_002E),
        blackPopulation: parseAcsNumber(r.B02001_003E),
        hispanicPopulation: parseAcsNumber(r.B03003_003E),
        asianPopulation: parseAcsNumber(r.B02001_005E),
        medianHouseholdIncome: parseAcsNumber(r.B19013_001E),
        povertyPopulation: parseAcsNumber(r.B17001_002E),
        bachelorsOrHigher: bachelorsOrHigherFromRow(r),
        ownerOccupiedHousing: parseAcsNumber(r.B25003_002E),
        renterOccupiedHousing: parseAcsNumber(r.B25003_003E),
      };

      await upsertPlaceAcs(sql, {
        geoCityId,
        stateFips: STATE_FIPS,
        placeFips,
        sourceYear: acsYear,
        importBatchId,
        facts,
      });
      upsertedFacts++;
    }

    console.log("[sync-census-places] complete");
    console.log("  import_batch_id:", importBatchId);
    console.log("  source_year:", acsYear);
    console.log("  places fetched:", fetched);
    console.log("  geo_cities upserted:", upsertedCities);
    console.log("  census_place_acs upserted:", upsertedFacts);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

