/** One row from `census_county_acs` (application shape). */
export type CensusCountyAcsRow = {
  id: number;
  countyId: number;
  sourceYear: number;
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

/** High-level coverage stats (dashboard / internal). */
export type CensusCoverageSummary = {
  latestYear: number | null;
  rowCount: number;
  countyCoverageCount: number;
};

/** `/api/census/status` payload. */
export type CensusStatus = {
  /** Query to `census_county_acs` succeeded (false if table missing, etc.). */
  tableReady: boolean;
  /** At least one row exists. */
  hasData: boolean;
  rowCount: number;
  latestSourceYear: number | null;
  countiesWithData: number;
  /** ISO 8601 — max `updated_at` from `census_county_acs` (last successful write). */
  latestImportAt: string | null;
};

/** `/api/census/summary` — latest ACS snapshot per county. */
export type CensusCountySnapshot = {
  countyName: string;
  sourceYear: number;
  totalPopulation: number | null;
  medianHouseholdIncome: number | null;
  blackPopulation: number | null;
  whitePopulation: number | null;
  hispanicPopulation: number | null;
  asianPopulation: number | null;
};
