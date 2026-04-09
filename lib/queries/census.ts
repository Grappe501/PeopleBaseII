import sql from "@/lib/db";
import type {
  CensusCountyAcsRow,
  CensusCountySnapshot,
  CensusCoverageSummary,
  CensusStatus,
} from "@/lib/types/census";

function mapRow(row: {
  id: string | number;
  county_id: string | number;
  source_year: number;
  total_population: string | number | null;
  voting_age_population: string | number | null;
  white_population: string | number | null;
  black_population: string | number | null;
  hispanic_population: string | number | null;
  asian_population: string | number | null;
  median_household_income: string | number | null;
  poverty_population: string | number | null;
  bachelors_or_higher: string | number | null;
  owner_occupied_housing: string | number | null;
  renter_occupied_housing: string | number | null;
}): CensusCountyAcsRow {
  return {
    id: Number(row.id),
    countyId: Number(row.county_id),
    sourceYear: row.source_year,
    totalPopulation: row.total_population !== null ? Number(row.total_population) : null,
    votingAgePopulation: row.voting_age_population !== null ? Number(row.voting_age_population) : null,
    whitePopulation: row.white_population !== null ? Number(row.white_population) : null,
    blackPopulation: row.black_population !== null ? Number(row.black_population) : null,
    hispanicPopulation: row.hispanic_population !== null ? Number(row.hispanic_population) : null,
    asianPopulation: row.asian_population !== null ? Number(row.asian_population) : null,
    medianHouseholdIncome: row.median_household_income !== null ? Number(row.median_household_income) : null,
    povertyPopulation: row.poverty_population !== null ? Number(row.poverty_population) : null,
    bachelorsOrHigher: row.bachelors_or_higher !== null ? Number(row.bachelors_or_higher) : null,
    ownerOccupiedHousing: row.owner_occupied_housing !== null ? Number(row.owner_occupied_housing) : null,
    renterOccupiedHousing: row.renter_occupied_housing !== null ? Number(row.renter_occupied_housing) : null,
  };
}

function formatImportTimestamp(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getCensusStatus(): Promise<CensusStatus> {
  const empty: CensusStatus = {
    tableReady: false,
    hasData: false,
    rowCount: 0,
    latestSourceYear: null,
    countiesWithData: 0,
    latestImportAt: null,
  };
  try {
    const [cnt, y, cov, imp] = await Promise.all([
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from census_county_acs
      `,
      sql<[{ y: number | null }]>`
        select max(source_year)::int as y from census_county_acs
      `,
      sql<[{ n: string | number }]>`
        select count(distinct county_id)::bigint as n from census_county_acs
      `,
      sql<[{ t: Date | null }]>`
        select max(updated_at) as t from census_county_acs
      `,
    ]);
    const rowCount = Number(cnt[0]?.n ?? 0);
    return {
      tableReady: true,
      hasData: rowCount > 0,
      rowCount,
      latestSourceYear: y[0]?.y ?? null,
      countiesWithData: Number(cov[0]?.n ?? 0),
      latestImportAt: formatImportTimestamp(imp[0]?.t ?? null),
    };
  } catch {
    return empty;
  }
}

export async function getCensusCountySummary(): Promise<CensusCoverageSummary> {
  const status = await getCensusStatus();
  return {
    latestYear: status.latestSourceYear,
    rowCount: status.rowCount,
    countyCoverageCount: status.countiesWithData,
  };
}

/** Latest `source_year` row per county (Arkansas). */
export async function getCensusCountySnapshots(): Promise<CensusCountySnapshot[]> {
  try {
    const rows = await sql<
      {
        county_name: string;
        source_year: number;
        total_population: string | number | null;
        median_household_income: string | number | null;
        black_population: string | number | null;
        white_population: string | number | null;
        hispanic_population: string | number | null;
        asian_population: string | number | null;
      }[]
    >`
      select distinct on (c.county_id)
        g.county_name,
        c.source_year,
        c.total_population,
        c.median_household_income,
        c.black_population,
        c.white_population,
        c.hispanic_population,
        c.asian_population
      from census_county_acs c
      join geo_counties g on g.id = c.county_id
      where g.state_fips = '05'
      order by c.county_id, c.source_year desc
    `;
    return rows.map((row) => ({
      countyName: row.county_name,
      sourceYear: row.source_year,
      totalPopulation: row.total_population !== null ? Number(row.total_population) : null,
      medianHouseholdIncome:
        row.median_household_income !== null ? Number(row.median_household_income) : null,
      blackPopulation: row.black_population !== null ? Number(row.black_population) : null,
      whitePopulation: row.white_population !== null ? Number(row.white_population) : null,
      hispanicPopulation: row.hispanic_population !== null ? Number(row.hispanic_population) : null,
      asianPopulation: row.asian_population !== null ? Number(row.asian_population) : null,
    }));
  } catch {
    return [];
  }
}

export async function getCensusCountyRows(
  limit = 50,
): Promise<Array<CensusCountyAcsRow & { countyName: string; countyKey: string }>> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  try {
    const rows = await sql<
      {
        id: string | number;
        county_id: string | number;
        source_year: number;
        total_population: string | number | null;
        voting_age_population: string | number | null;
        white_population: string | number | null;
        black_population: string | number | null;
        hispanic_population: string | number | null;
        asian_population: string | number | null;
        median_household_income: string | number | null;
        poverty_population: string | number | null;
        bachelors_or_higher: string | number | null;
        owner_occupied_housing: string | number | null;
        renter_occupied_housing: string | number | null;
        county_name: string;
        county_key: string;
      }[]
    >`
      select distinct on (c.county_id)
        c.id,
        c.county_id,
        c.source_year,
        c.total_population,
        c.voting_age_population,
        c.white_population,
        c.black_population,
        c.hispanic_population,
        c.asian_population,
        c.median_household_income,
        c.poverty_population,
        c.bachelors_or_higher,
        c.owner_occupied_housing,
        c.renter_occupied_housing,
        g.county_name,
        g.county_key
      from census_county_acs c
      join geo_counties g on g.id = c.county_id
      order by c.county_id, c.source_year desc
      limit ${safeLimit}
    `;
    return rows.map((row) => ({
      ...mapRow(row),
      countyName: row.county_name,
      countyKey: row.county_key,
    }));
  } catch {
    return [];
  }
}

export async function getLatestCensusByCounty(
  countyKey: string,
): Promise<CensusCountyAcsRow | null> {
  const key = countyKey.trim();
  if (!key) return null;
  try {
    const rows = await sql<
      {
        id: string | number;
        county_id: string | number;
        source_year: number;
        total_population: string | number | null;
        voting_age_population: string | number | null;
        white_population: string | number | null;
        black_population: string | number | null;
        hispanic_population: string | number | null;
        asian_population: string | number | null;
        median_household_income: string | number | null;
        poverty_population: string | number | null;
        bachelors_or_higher: string | number | null;
        owner_occupied_housing: string | number | null;
        renter_occupied_housing: string | number | null;
      }[]
    >`
      select c.id, c.county_id, c.source_year, c.total_population, c.voting_age_population,
             c.white_population, c.black_population, c.hispanic_population, c.asian_population,
             c.median_household_income, c.poverty_population, c.bachelors_or_higher,
             c.owner_occupied_housing, c.renter_occupied_housing
      from census_county_acs c
      join geo_counties g on g.id = c.county_id
      where g.county_key = ${key}
      order by c.source_year desc
      limit 1
    `;
    const row = rows[0];
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}
