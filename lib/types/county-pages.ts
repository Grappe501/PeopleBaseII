export type StatewideCountyRow = {
  countyId: number;
  countyName: string;
  countyKey: string | null;
  countyFips: string | null;
  vrUniqueVoters: number;
  expectedTurnoutVotes: number;
  countyTargetVotes: number;
  countyPriorityScore: number | null;
};

export type CountyDetailRow = {
  countyId: number;
  countyName: string;
  countyKey: string | null;
  stateFips: string;
  countyFips: string;

  totalPopulation: number | null;
  votingAgePopulation: number | null;
  vrUniqueVoters: number;
  registrationRatePct: number | null;
  vhUniqueVoters: number;
  turnoutRatePct: number | null;

  demPct2022Governor: number | null;
  demPct2024President: number | null;
  demPct2026Sos: number | null;

  statewideVoteTarget: number;
  countyTargetVotes: number;
  expectedTurnoutVotes: number;
  expectedDemocraticBaselineVotes: number;

  countyPriorityScore: number | null;

  topPrecinctsByPriority: unknown[] | null;
};

export type CountyCityRow = {
  countyId: number;
  countyName: string;
  cityKey: string;
  cityName: string;
  cityVrUniqueVoters: number;
  cityEstimatedTotalPopulation: number | null;
  censusPlaceTotalPopulation: number | null;
  censusPlaceVotingAgePopulation: number | null;
  cityExpectedTurnoutVotes: number;
  cityPossibleDemVoters: number;
  cityTargetVotes: number;
};

export type CountyPrecinctRow = {
  countyId: number;
  countyName: string;
  precinctLabel: string;
  registeredVoters: number | null;
  turnoutVoters: number | null;
  turnoutRatePct: number | null;
  demPct2024President: number | null;
  precinctPriorityScore: number | null;
};

