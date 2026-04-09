export type DashboardOverview = {
  totalRawVrRows: number;
  countyCount: number;
  lastImportedAt: string | null;
  databaseTime: string | null;
  databaseOnline: boolean;
};

export type CountySummaryRow = {
  county: string;
  voterCount: number;
  uniqueVoterCount: number;
};

export type DashboardStatus = {
  hasCountyColumn: boolean;
  hasVoterIdColumn: boolean;
  rowsWithCounty: number;
  rowsWithVoterId: number;
  distinctVoterIds: number;
  duplicateResidue: number;
};
