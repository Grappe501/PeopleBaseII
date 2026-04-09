import sql from "@/lib/db";
import type {
  CountyAnalyticsOverview,
  CountyEconomicStressRow,
  CountyPowerProfileRow,
  CountyRegistrationGapRow,
  PrecinctPerformanceRow,
  PrecinctTurnoutGapRow,
} from "@/lib/types/analytics";

const REG_GAP_ORDER = {
  name: "county_name asc",
  penetrationAsc: "registration_penetration_rate asc nulls last, county_name asc",
} as const;

export type CountyRegistrationGapSort = keyof typeof REG_GAP_ORDER;

export async function getCountyRegistrationGaps(
  sort: CountyRegistrationGapSort = "name",
): Promise<CountyRegistrationGapRow[]> {
  const orderBy = REG_GAP_ORDER[sort] ?? REG_GAP_ORDER.name;
  try {
    const rows = await sql.unsafe<
      {
        state_fips: string;
        county_fips: string;
        county_name: string;
        registered_voters: string | number;
        voting_age_population: string | number | null;
        registration_penetration_rate: string | number | null;
      }[]
    >(
      `select state_fips, county_fips, county_name, registered_voters, voting_age_population,
              registration_penetration_rate
       from analytics_county_registration_gap
       order by ${orderBy}`,
    );
    return rows.map((row) => ({
      stateFips: row.state_fips,
      countyFips: row.county_fips,
      countyName: row.county_name,
      registeredVoters: Number(row.registered_voters),
      votingAgePopulation:
        row.voting_age_population !== null
          ? Number(row.voting_age_population)
          : null,
      registrationPenetrationRate:
        row.registration_penetration_rate !== null
          ? Number(row.registration_penetration_rate)
          : null,
    }));
  } catch {
    return [];
  }
}

export async function getCountyPowerProfiles(): Promise<CountyPowerProfileRow[]> {
  try {
    const rows = await sql<
      {
        state_fips: string;
        county_fips: string;
        county_name: string;
        registered_voters: string | number;
        voting_age_population: string | number | null;
        registration_penetration_rate: string | number | null;
        median_household_income: string | number | null;
        poverty_population: string | number | null;
        white_population: string | number | null;
        black_population: string | number | null;
        hispanic_population: string | number | null;
        asian_population: string | number | null;
      }[]
    >`
      select state_fips, county_fips, county_name, registered_voters, voting_age_population,
             registration_penetration_rate, median_household_income,
             poverty_population, white_population, black_population,
             hispanic_population, asian_population
      from analytics_county_power_profile
      order by county_name asc
    `;
    return rows.map((row) => ({
      stateFips: row.state_fips,
      countyFips: row.county_fips,
      countyName: row.county_name,
      registeredVoters: Number(row.registered_voters),
      votingAgePopulation:
        row.voting_age_population !== null
          ? Number(row.voting_age_population)
          : null,
      registrationPenetrationRate:
        row.registration_penetration_rate !== null
          ? Number(row.registration_penetration_rate)
          : null,
      medianHouseholdIncome:
        row.median_household_income !== null
          ? Number(row.median_household_income)
          : null,
      povertyPopulation:
        row.poverty_population !== null
          ? Number(row.poverty_population)
          : null,
      whitePopulation:
        row.white_population !== null ? Number(row.white_population) : null,
      blackPopulation:
        row.black_population !== null ? Number(row.black_population) : null,
      hispanicPopulation:
        row.hispanic_population !== null
          ? Number(row.hispanic_population)
          : null,
      asianPopulation:
        row.asian_population !== null ? Number(row.asian_population) : null,
    }));
  } catch {
    return [];
  }
}

export async function getCountyAnalyticsOverview(): Promise<CountyAnalyticsOverview> {
  const empty: CountyAnalyticsOverview = {
    totalRegisteredVoters: 0,
    countyCount: 0,
    latestCensusYear: null,
    averageRegistrationPenetrationRate: null,
  };
  try {
    const rows = await sql<
      {
        total_registered_voters: string | number | null;
        county_count: string | number | null;
        latest_census_year: number | null;
        average_registration_penetration_rate: string | number | null;
      }[]
    >`
      select
        (select coalesce(sum(registered_voters), 0)::bigint
           from analytics_county_registration_gap) as total_registered_voters,
        (select count(*)::bigint from geo_counties where state_fips = '05') as county_count,
        (select max(source_year)::int from census_county_acs) as latest_census_year,
        (select round(avg(registration_penetration_rate)::numeric, 2)
           from analytics_county_registration_gap
          where registration_penetration_rate is not null) as average_registration_penetration_rate
    `;
    const row = rows[0];
    if (!row) return empty;
    return {
      totalRegisteredVoters: Number(row.total_registered_voters ?? 0),
      countyCount: Number(row.county_count ?? 0),
      latestCensusYear: row.latest_census_year,
      averageRegistrationPenetrationRate:
        row.average_registration_penetration_rate !== null
          ? Number(row.average_registration_penetration_rate)
          : null,
    };
  } catch {
    return empty;
  }
}

export async function getPrecinctPerformanceTrend(
  precinctKey: string,
): Promise<PrecinctPerformanceRow[]> {
  const key = precinctKey.trim();
  if (!key) return [];
  try {
    const rows = await sql<
      {
        precinct_key: string;
        county_name: string;
        election_year: number;
        office_name: string;
        democratic_votes: string | number;
        republican_votes: string | number;
        total_votes: string | number;
        dem_vote_share: string | number | null;
        rep_vote_share: string | number | null;
      }[]
    >`
      select precinct_key, county_name, election_year, office_name,
             democratic_votes, republican_votes, total_votes,
             dem_vote_share, rep_vote_share
      from analytics_precinct_performance
      where precinct_key = ${key}
      order by election_year desc, office_name
      limit 200
    `;
    return rows.map((row) => ({
      precinctKey: row.precinct_key,
      countyName: row.county_name,
      electionYear: row.election_year,
      officeName: row.office_name,
      democraticVotes: Number(row.democratic_votes),
      republicanVotes: Number(row.republican_votes),
      totalVotes: Number(row.total_votes),
      demVoteShare:
        row.dem_vote_share !== null ? Number(row.dem_vote_share) : null,
      repVoteShare:
        row.rep_vote_share !== null ? Number(row.rep_vote_share) : null,
    }));
  } catch {
    return [];
  }
}

export async function getPrecinctTurnoutGaps(): Promise<PrecinctTurnoutGapRow[]> {
  try {
    const rows = await sql<
      {
        precinct_key: string;
        county_name: string;
        election_year: number;
        registered_voters: string | number | null;
        ballots_cast: string | number | null;
        turnout_rate: string | number | null;
      }[]
    >`
      select precinct_key, county_name, election_year, registered_voters,
             ballots_cast, turnout_rate
      from analytics_precinct_turnout_gap
      order by election_year desc, county_name, precinct_key
      limit 5000
    `;
    return rows.map((row) => ({
      precinctKey: row.precinct_key,
      countyName: row.county_name,
      electionYear: row.election_year,
      registeredVoters:
        row.registered_voters !== null ? Number(row.registered_voters) : null,
      ballotsCast: row.ballots_cast !== null ? Number(row.ballots_cast) : null,
      turnoutRate: row.turnout_rate !== null ? Number(row.turnout_rate) : null,
    }));
  } catch {
    return [];
  }
}

export async function getCountyEconomicStressRows(): Promise<
  CountyEconomicStressRow[]
> {
  try {
    const rows = await sql<
      {
        county_name: string;
        median_household_income: string | number | null;
        poverty_population: string | number | null;
        unemployment_rate: string | number | null;
        average_weekly_wage: string | number | null;
      }[]
    >`
      select county_name, median_household_income, poverty_population,
             unemployment_rate, average_weekly_wage
      from analytics_county_economic_stress
      order by county_name
    `;
    return rows.map((row) => ({
      countyName: row.county_name,
      medianHouseholdIncome:
        row.median_household_income !== null
          ? Number(row.median_household_income)
          : null,
      povertyPopulation:
        row.poverty_population !== null
          ? Number(row.poverty_population)
          : null,
      unemploymentRate:
        row.unemployment_rate !== null ? Number(row.unemployment_rate) : null,
      averageWeeklyWage:
        row.average_weekly_wage !== null
          ? Number(row.average_weekly_wage)
          : null,
    }));
  } catch {
    return [];
  }
}
