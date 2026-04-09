/** Row from `analytics_county_registration_gap` (Census VAP vs VR counts). */
export type CountyRegistrationGapRow = {
  stateFips: string;
  countyFips: string;
  countyName: string;
  registeredVoters: number;
  votingAgePopulation: number | null;
  registrationPenetrationRate: number | null;
};

/** Row from `analytics_county_power_profile` (registration + ACS demographics). */
export type CountyPowerProfileRow = {
  stateFips: string;
  countyFips: string;
  countyName: string;
  registeredVoters: number;
  votingAgePopulation: number | null;
  registrationPenetrationRate: number | null;
  medianHouseholdIncome: number | null;
  povertyPopulation: number | null;
  whitePopulation: number | null;
  blackPopulation: number | null;
  hispanicPopulation: number | null;
  asianPopulation: number | null;
};

/** State-level rollups for the county analytics layer. */
export type CountyAnalyticsOverview = {
  totalRegisteredVoters: number;
  countyCount: number;
  latestCensusYear: number | null;
  averageRegistrationPenetrationRate: number | null;
};

export type PrecinctPerformanceRow = {
  precinctKey: string;
  countyName: string;
  electionYear: number;
  officeName: string;
  democraticVotes: number;
  republicanVotes: number;
  totalVotes: number;
  demVoteShare: number | null;
  repVoteShare: number | null;
};

export type PrecinctTurnoutGapRow = {
  precinctKey: string;
  countyName: string;
  electionYear: number;
  registeredVoters: number | null;
  ballotsCast: number | null;
  turnoutRate: number | null;
};

export type CountyEconomicStressRow = {
  countyName: string;
  medianHouseholdIncome: number | null;
  povertyPopulation: number | null;
  unemploymentRate: number | null;
  averageWeeklyWage: number | null;
};
