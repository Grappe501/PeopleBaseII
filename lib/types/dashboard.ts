export type DashboardOverview = {
  totalRawVrRows: number;
  countyCount: number;
  lastImportedAt: string | null;
  databaseTime: string | null;
  databaseOnline: boolean;
};

export type CountySummaryRow = {
  county: string;
  countyKey?: string | null;
  countyId?: number | null;
  voterCount: number;
  uniqueVoterCount: number;

  // When statewide_county_master_v is available, we can show richer intelligence.
  registeredVoters?: number | null;
  expectedTurnoutVotes?: number | null;
  registrationRatePct?: number | null;
  turnoutRatePct?: number | null;
  countyPriorityScore?: number | null;
  registrationsWindowUniqueVoters?: number | null;
};

export type DashboardStatus = {
  hasCountyColumn: boolean;
  hasVoterIdColumn: boolean;
  rowsWithCounty: number;
  rowsWithVoterId: number;
  distinctVoterIds: number;
  duplicateResidue: number;
};
