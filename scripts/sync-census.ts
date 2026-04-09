import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

const censusApiKey = process.env.CENSUS_API_KEY?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

console.log("CENSUS key present?", Boolean(censusApiKey));
console.log("CENSUS key length:", censusApiKey?.length ?? 0);
console.log("DATABASE_URL present?", Boolean(databaseUrl));

/**
 * Arkansas county-level ACS 5-year sync → `census_county_acs`.
 *
 * Env: DATABASE_URL, CENSUS_API_KEY
 * Optional: CENSUS_ACS_YEAR (ACS data release year, e.g. 2022 for 2018–2022 estimates)
 *
 * Run: npm run sync:census
 */
import { randomBytes } from "node:crypto";
import postgres, { type Sql } from "postgres";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATE_FIPS = "05";
const DATA_SOURCE = "census_acs5" as const;

type CensusSyncConfig = {
  stateFips: string;
  acsDataYear: number;
  databaseUrl: string;
  apiKey: string;
  dataSource: typeof DATA_SOURCE;
};

function loadCensusSyncConfig(): CensusSyncConfig {
  if (!databaseUrl) {
    throw new Error(
      "Missing required environment variable: DATABASE_URL. Set it in your shell or in a .env file (e.g. .env.local) loaded for this process.",
    );
  }
  if (!censusApiKey) {
    throw new Error(
      "Missing required environment variable: CENSUS_API_KEY. Set it in your shell or in a .env file (e.g. .env.local) loaded for this process.",
    );
  }

  const acsDataYear = Number(process.env.CENSUS_ACS_YEAR ?? "2022");
  if (!Number.isFinite(acsDataYear) || acsDataYear < 2009) {
    throw new Error("Invalid CENSUS_ACS_YEAR");
  }

  return {
    stateFips: STATE_FIPS,
    acsDataYear,
    databaseUrl,
    apiKey: censusApiKey,
    dataSource: DATA_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// Batch id (UUID v7 — time-ordered, suitable for import_batch_id)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ACS variable registry (add entries here to pull more columns)
// ---------------------------------------------------------------------------

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

/** Census Data API limits each `get=` to 50 variables; split pulls and merge by FIPS. */
const CENSUS_API_GET_MAX_VARIABLES = 50;

/**
 * Request A — NAME + ACS variables; `state`/`county` FIPS are returned after `get=` columns (geography).
 * (Voting-age buckets and education are in request B.)
 */
const ACS_COUNTY_GET_REQUEST_A = [
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
] as const;

/**
 * Request B — NAME + B01001 / B15003 variables; `state`/`county` FIPS appended by the API (geography).
 */
const ACS_COUNTY_GET_REQUEST_B = [
  "NAME",
  ...B01001_MALE_18_PLUS,
  ...B01001_FEMALE_18_PLUS,
  ...B15003_BACHELORS_PLUS,
] as const;

const ACS_COUNTY_GET_GROUPS = [
  { label: "ACS county request A (population, race, income, poverty, housing)", vars: ACS_COUNTY_GET_REQUEST_A },
  { label: "ACS county request B (voting-age age buckets, education)", vars: ACS_COUNTY_GET_REQUEST_B },
] as const;

/** One data row from request A (`get=` columns then `state`, `county` from geography). */
type CensusCountyRequestARow = { [K in (typeof ACS_COUNTY_GET_REQUEST_A)[number]]: string } & {
  state: string;
  county: string;
};

/**
 * One data row from request B. `NAME` / `state` / `county` align with the API header
 * even though dynamic `B01001_*` lists widen the `as const` `get=` tuple to `string[]`.
 */
type CensusCountyRequestBRow = Pick<CensusCountyRequestARow, "NAME" | "state" | "county"> &
  { [K in (typeof B01001_MALE_18_PLUS)[number] | (typeof B01001_FEMALE_18_PLUS)[number] | (typeof B15003_BACHELORS_PLUS)[number]]: string };

/** Shallow merge of A and B for the same county; merge key is state + county FIPS only. */
type CensusCountyMergedApiRow = CensusCountyRequestARow & CensusCountyRequestBRow;

/** Raw ACS `get=` response: row 0 = variable names, rest = data rows */
type CensusAcsCountyJsonPayload = string[][];

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

/**
 * ACS 5-year county detail for one state:
 * `https://api.census.gov/data/{year}/acs/acs5?get=NAME,...&for=county:*&in=state:{fips}&key=...`
 *
 * Build the query with `URLSearchParams({ ..., key: apiKey })` and `params.toString()` only.
 * Do not `encodeURIComponent` the key (or pre-encode it in env) — that would double-encode.
 */

/** For logs and error text only — masks `key`. */
function censusUrlForDisplay(fullUrl: string): string {
  const u = new URL(fullUrl);
  if (u.searchParams.has("key")) {
    u.searchParams.set("key", "***");
  }
  return u.toString();
}

function isJsonContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("application/json");
}

function bodyPreview(text: string, maxChars = 500): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
}

class CensusApiFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CensusApiFetchError";
  }
}

function throwNonJsonCensusResponse(params: {
  status: number;
  statusText: string;
  requestUrl: string;
  contentType: string;
  bodyText: string;
}): never {
  const { status, statusText, requestUrl, contentType, bodyText } = params;
  throw new CensusApiFetchError(
    [
      "Census API returned a non-JSON response (often HTML from a gateway, CAPTCHA, or bad URL).",
      `HTTP ${status} ${statusText}`,
      `Content-Type: ${contentType || "(missing)"}`,
      `Request URL: ${requestUrl}`,
      `Body (first 500 chars): ${bodyPreview(bodyText)}`,
    ].join("\n"),
  );
}

function throwCensusHttpError(params: {
  status: number;
  statusText: string;
  requestUrl: string;
  bodyText: string;
}): never {
  const { status, statusText, requestUrl, bodyText } = params;
  throw new CensusApiFetchError(
    [
      `Census API request failed: HTTP ${status} ${statusText}`,
      `Request URL: ${requestUrl}`,
      `Body (first 500 chars): ${bodyPreview(bodyText)}`,
    ].join("\n"),
  );
}

function parseCensusAcsCountyPayload(raw: unknown, requestUrl: string): CensusAcsCountyJsonPayload {
  if (!Array.isArray(raw)) {
    throw new CensusApiFetchError(
      `Census API JSON was not an array.\nRequest URL: ${requestUrl}\nParsed type: ${typeof raw}`,
    );
  }
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!Array.isArray(row) || !row.every((c) => typeof c === "string")) {
      throw new CensusApiFetchError(
        `Census API JSON row ${i} is not string[][].\nRequest URL: ${requestUrl}`,
      );
    }
  }
  return raw as CensusAcsCountyJsonPayload;
}

function parseCensusCountyResponseToPayload(params: {
  res: Response;
  contentType: string;
  bodyText: string;
  requestUrl: string;
}): CensusAcsCountyJsonPayload {
  const { res, contentType, bodyText, requestUrl } = params;

  if (/invalid key/i.test(bodyText) && contentType.toLowerCase().includes("html")) {
    throw new CensusApiFetchError(
      [
        'Census API returned "Invalid Key" (HTML). Check CENSUS_API_KEY: use the full key from key signup, no typos or truncation.',
        "PowerShell: set $env:CENSUS_API_KEY to your key string in double quotes.",
        "Or set CENSUS_API_KEY in .env.local as a single line: CENSUS_API_KEY=your_key_here",
        `Request URL: ${requestUrl}`,
      ].join("\n"),
    );
  }

  if (!isJsonContentType(contentType)) {
    throwNonJsonCensusResponse({
      status: res.status,
      statusText: res.statusText,
      requestUrl,
      contentType,
      bodyText,
    });
  }

  if (!res.ok) {
    throwCensusHttpError({
      status: res.status,
      statusText: res.statusText,
      requestUrl,
      bodyText,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText) as unknown;
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    throw new CensusApiFetchError(
      [
        `Census API returned Content-Type JSON but body failed to parse: ${hint}`,
        `Request URL: ${requestUrl}`,
        `Body (first 500 chars): ${bodyPreview(bodyText)}`,
      ].join("\n"),
    );
  }

  return parseCensusAcsCountyPayload(parsed, requestUrl);
}

/**
 * Census Data API allows at most 50 variables per `get=`; fail before any HTTP request.
 */
function assertCensusGetLimit(label: string, vars: readonly string[]): void {
  const n = vars.length;
  if (n > CENSUS_API_GET_MAX_VARIABLES) {
    throw new CensusApiFetchError(
      [
        `Census API 'get' is limited to ${CENSUS_API_GET_MAX_VARIABLES} variables per request.`,
        `${label} would send ${n} variables. Split the variable list further.`,
      ].join(" "),
    );
  }
}

/** Geography columns the Census API appends after `get=` for `for=county:*` + `in=state:…`. */
const COUNTY_RESPONSE_GEO_KEYS = ["state", "county"] as const;

function payloadToTypedCountyRows<const V extends readonly string[]>(
  payload: CensusAcsCountyJsonPayload,
  requestedGetVars: V,
  requestLabel: string,
): Array<{ [K in V[number] | (typeof COUNTY_RESPONSE_GEO_KEYS)[number]]: string }> {
  if (!payload.length) return [];
  const header = payload[0];
  if (!header) return [];
  const expectedHeader = [...requestedGetVars, ...COUNTY_RESPONSE_GEO_KEYS];
  if (
    header.length !== expectedHeader.length ||
    !header.every((h, i) => h === expectedHeader[i])
  ) {
    throw new CensusApiFetchError(
      [
        `Census ACS ${requestLabel}: response header mismatch.`,
        `Expected: ${expectedHeader.join(",")}`,
        `Got: ${header.join(",")}`,
      ].join("\n"),
    );
  }
  return payload.slice(1).map((cells) => {
    const row = {} as { [K in V[number] | (typeof COUNTY_RESPONSE_GEO_KEYS)[number]]: string };
    expectedHeader.forEach((key, i) => {
      row[key as V[number] | (typeof COUNTY_RESPONSE_GEO_KEYS)[number]] = cells[i] ?? "";
    });
    return row;
  });
}

/** Trim then zero-pad so API/DB strings with whitespace or char(n) padding match. */
function normalizeStateFips(v: string): string {
  return v.trim().padStart(2, "0");
}

function normalizeCountyFips(v: string): string {
  return v.trim().padStart(3, "0");
}

/** Stable merge key: state FIPS + county FIPS (zero-padded). Never use NAME. */
function apiRowMergeKey(row: { state: string; county: string }): string {
  return `${normalizeStateFips(row.state)}:${normalizeCountyFips(row.county)}`;
}

function indexCountyRowsByMergeKey<R extends { state: string; county: string }>(
  rows: R[],
  requestLabel: string,
): Map<string, R> {
  const map = new Map<string, R>();
  for (const row of rows) {
    const k = apiRowMergeKey(row);
    if (map.has(k)) {
      throw new CensusApiFetchError(
        `Census ACS ${requestLabel}: duplicate county key ${k} in API response.`,
      );
    }
    map.set(k, { ...row });
  }
  return map;
}

/**
 * Merge A and B by state + county FIPS only; overlapping columns (NAME, state, county) should agree.
 */
function mergeCountyAcsTypedRows(
  rowsA: CensusCountyRequestARow[],
  rowsB: CensusCountyRequestBRow[],
): CensusCountyMergedApiRow[] {
  const mapA = indexCountyRowsByMergeKey(rowsA, "request A");
  const mapB = indexCountyRowsByMergeKey(rowsB, "request B");
  if (mapA.size !== mapB.size) {
    throw new CensusApiFetchError(
      [
        "Census ACS merge: county count mismatch between split requests.",
        `Request A: ${mapA.size} counties, request B: ${mapB.size} counties.`,
      ].join(" "),
    );
  }
  for (const k of mapA.keys()) {
    if (!mapB.has(k)) {
      throw new CensusApiFetchError(
        `Census ACS merge: county key ${k} present in request A but missing from request B.`,
      );
    }
  }
  const merged: CensusCountyMergedApiRow[] = [];
  for (const [k, rowA] of mapA) {
    const rowB = mapB.get(k);
    if (!rowB) {
      throw new CensusApiFetchError(
        `Census ACS merge: county key ${k} present in request A but missing from request B.`,
      );
    }
    merged.push({ ...rowA, ...rowB });
  }
  return merged;
}

async function fetchCountyAcsRequestA(cfg: CensusSyncConfig): Promise<CensusCountyRequestARow[]> {
  const label = ACS_COUNTY_GET_GROUPS[0].label;
  assertCensusGetLimit(label, ACS_COUNTY_GET_REQUEST_A);

  const year = cfg.acsDataYear;
  const params = new URLSearchParams({
    get: ACS_COUNTY_GET_REQUEST_A.join(","),
    for: "county:*",
    in: `state:${cfg.stateFips}`,
    key: cfg.apiKey,
  });
  const url = `https://api.census.gov/data/${year}/acs/acs5?${params.toString()}`;
  const requestUrlForLog = censusUrlForDisplay(url);

  console.log(`[sync-census] ${label}`);
  console.log("[sync-census] Census request URL:", requestUrlForLog);

  const res = await fetch(url);
  const contentType = res.headers.get("content-type") ?? "";
  console.log("[sync-census] response:", { label, ok: res.ok, contentType });

  const bodyText = await res.text();
  const payload = parseCensusCountyResponseToPayload({
    res,
    contentType,
    bodyText,
    requestUrl: requestUrlForLog,
  });
  return payloadToTypedCountyRows(payload, ACS_COUNTY_GET_REQUEST_A, label);
}

async function fetchCountyAcsRequestB(cfg: CensusSyncConfig): Promise<CensusCountyRequestBRow[]> {
  const label = ACS_COUNTY_GET_GROUPS[1].label;
  assertCensusGetLimit(label, ACS_COUNTY_GET_REQUEST_B);

  const year = cfg.acsDataYear;
  const params = new URLSearchParams({
    get: ACS_COUNTY_GET_REQUEST_B.join(","),
    for: "county:*",
    in: `state:${cfg.stateFips}`,
    key: cfg.apiKey,
  });
  const url = `https://api.census.gov/data/${year}/acs/acs5?${params.toString()}`;
  const requestUrlForLog = censusUrlForDisplay(url);

  console.log(`[sync-census] ${label}`);
  console.log("[sync-census] Census request URL:", requestUrlForLog);

  const res = await fetch(url);
  const contentType = res.headers.get("content-type") ?? "";
  console.log("[sync-census] response:", { label, ok: res.ok, contentType });

  const bodyText = await res.text();
  const payload = parseCensusCountyResponseToPayload({
    res,
    contentType,
    bodyText,
    requestUrl: requestUrlForLog,
  });
  // `ACS_COUNTY_GET_REQUEST_B` includes `.map()`-built lists, so TS widens the row type; header check guarantees shape.
  return payloadToTypedCountyRows(payload, ACS_COUNTY_GET_REQUEST_B, label) as CensusCountyRequestBRow[];
}

async function fetchCountyAcsRows(cfg: CensusSyncConfig): Promise<CensusCountyMergedApiRow[]> {
  const [rowsA, rowsB] = await Promise.all([
    fetchCountyAcsRequestA(cfg),
    fetchCountyAcsRequestB(cfg),
  ]);
  return mergeCountyAcsTypedRows(rowsA, rowsB);
}

// ---------------------------------------------------------------------------
// Field mapper — raw ACS strings → typed facts (Census null sentinels → null)
// ---------------------------------------------------------------------------

const CENSUS_NULL_SENTINELS = new Set([
  "-666666666",
  "-666666666.0",
  "-888888888",
  "-888888888.0",
  "-555555555",
  "-333333333",
]);

type MappedCountyAcsFacts = {
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

/** Derived after merge: sum of B01001 male + female cells for ages 18+. */
function votingAgePopulationFromMergedRow(row: CensusCountyMergedApiRow): number | null {
  const maleVap = sumVars(row, B01001_MALE_18_PLUS);
  const femaleVap = sumVars(row, B01001_FEMALE_18_PLUS);
  if (maleVap === null && femaleVap === null) return null;
  return (maleVap ?? 0) + (femaleVap ?? 0);
}

/** Derived after merge: B15003_022E–B15003_025E (bachelor’s through doctorate). */
function bachelorsOrHigherFromMergedRow(row: CensusCountyMergedApiRow): number | null {
  return sumVars(row, B15003_BACHELORS_PLUS);
}

function mapMergedRowToCountyFacts(row: CensusCountyMergedApiRow): MappedCountyAcsFacts {
  return {
    totalPopulation: parseAcsNumber(row.B01003_001E),
    votingAgePopulation: votingAgePopulationFromMergedRow(row),
    whitePopulation: parseAcsNumber(row.B02001_002E),
    blackPopulation: parseAcsNumber(row.B02001_003E),
    hispanicPopulation: parseAcsNumber(row.B03003_003E),
    asianPopulation: parseAcsNumber(row.B02001_005E),
    medianHouseholdIncome: parseAcsNumber(row.B19013_001E),
    povertyPopulation: parseAcsNumber(row.B17001_002E),
    bachelorsOrHigher: bachelorsOrHigherFromMergedRow(row),
    ownerOccupiedHousing: parseAcsNumber(row.B25003_002E),
    renterOccupiedHousing: parseAcsNumber(row.B25003_003E),
  };
}

// ---------------------------------------------------------------------------
// County lookup (FIPS only — never by name)
// ---------------------------------------------------------------------------

function countyLookupKey(stateFips: string, countyFips: string): string {
  return `${normalizeStateFips(stateFips)}:${normalizeCountyFips(countyFips)}`;
}

async function loadArkansasCountyLookup(sql: Sql): Promise<Map<string, number>> {
  const rows = await sql<{ id: string | number; state_fips: string; county_fips: string }[]>`
    select id, state_fips, county_fips
    from geo_counties
    where state_fips = ${STATE_FIPS}
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    // char(n) may include trailing spaces; API returns unpadded numeric strings.
    const key = countyLookupKey(String(r.state_fips), String(r.county_fips));
    map.set(key, Number(r.id));
  }
  return map;
}

function resolveCountyId(
  lookup: Map<string, number>,
  apiState: string,
  apiCounty: string,
): number | undefined {
  return lookup.get(countyLookupKey(apiState, apiCounty));
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

async function upsertCountyAcsRow(
  sql: Sql,
  params: {
    countyId: number;
    sourceYear: number;
    batchId: string;
    dataSource: typeof DATA_SOURCE;
    facts: MappedCountyAcsFacts;
  },
): Promise<void> {
  const { countyId, sourceYear, batchId, dataSource, facts } = params;
  await sql`
    insert into census_county_acs (
      county_id,
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
    )
    values (
      ${countyId},
      ${sourceYear},
      ${facts.totalPopulation},
      ${facts.votingAgePopulation},
      ${facts.whitePopulation},
      ${facts.blackPopulation},
      ${facts.hispanicPopulation},
      ${facts.asianPopulation},
      ${facts.medianHouseholdIncome},
      ${facts.povertyPopulation},
      ${facts.bachelorsOrHigher},
      ${facts.ownerOccupiedHousing},
      ${facts.renterOccupiedHousing},
      ${dataSource},
      ${batchId}
    )
    on conflict (county_id, source_year) do update set
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cfg = loadCensusSyncConfig();
  const batchId = newUuidV7();
  const sql = postgres(cfg.databaseUrl, { ssl: "require", max: 3 });

  let fetched = 0;
  let matched = 0;
  let upserted = 0;
  let failed = 0;
  const unmatched: { state: string; county: string; name: string }[] = [];

  try {
    const [apiRows, lookup] = await Promise.all([
      fetchCountyAcsRows(cfg),
      loadArkansasCountyLookup(sql),
    ]);
    fetched = apiRows.length;

    for (const row of apiRows) {
      const apiState = row.state ?? "";
      const apiCounty = row.county ?? "";
      const name = row.NAME ?? "";

      if (normalizeStateFips(apiState) !== normalizeStateFips(cfg.stateFips)) {
        unmatched.push({ state: apiState, county: apiCounty, name });
        continue;
      }

      const countyId = resolveCountyId(lookup, apiState, apiCounty);
      if (countyId === undefined) {
        unmatched.push({
          state: apiState.padStart(2, "0"),
          county: apiCounty.padStart(3, "0"),
          name,
        });
        continue;
      }

      matched++;
      const facts = mapMergedRowToCountyFacts(row);
      try {
        await upsertCountyAcsRow(sql, {
          countyId,
          sourceYear: cfg.acsDataYear,
          batchId,
          dataSource: cfg.dataSource,
          facts,
        });
        upserted++;
      } catch (e) {
        failed++;
        console.error(
          `Upsert failed county_id=${countyId} FIPS=${apiState}/${apiCounty.padStart(3, "0")}:`,
          e,
        );
      }
    }

    console.log("Census ACS county sync complete");
    console.log(`  import_batch_id: ${batchId}`);
    console.log(`  source_year (ACS data year): ${cfg.acsDataYear}`);
    console.log(`  rows fetched (API):     ${fetched}`);
    console.log(`  rows matched (FIPS):    ${matched}`);
    console.log(`  rows upserted:          ${upserted}`);
    console.log(`  unmatched rows:         ${unmatched.length}`);
    console.log(`  failed rows:            ${failed}`);

    if (unmatched.length) {
      console.warn("Unmatched county FIPS (no geo_counties row for state_fips + county_fips):");
      for (const u of unmatched) {
        console.warn(`  state=${u.state} county=${u.county} NAME=${u.name}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
