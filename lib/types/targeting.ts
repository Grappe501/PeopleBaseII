export type Cd2DemTargetPrecinctRow = {
  countyId: string | number;
  countyName: string | null;
  precinctLabel: string | null;
  registeredVoters: number | null;
  baselineDemPct: number | null;
  turnoutRatePct: number | null;
  demGrowthTargetScore: number | null;
  voterDensityWeight0_100: number | null;
  persuasionSwingScore0_100: number | null;
  mobilizationBlendScore: number | null;
  targetQuintile: number | null;
  targetTier: string | null;
  precinctPriorityScoreBalanced: number | null;
};

export type Cd2DemTargetVoterRow = {
  voterId: string | null;
  keyRegistrant: string | null;
  countyId: string | number;
  countyName: string | null;
  precinctLabel: string | null;
  partyRaw: string | null;
  demLeanScore: number | null;
  demLeanHeadroom: number | null;
  precinctDemGrowthTargetScore: number | null;
  precinctTargetQuintile: number | null;
  precinctTargetTier: string | null;
  precinctVoterDensityWeight0_100: number | null;
  voterDemGrowthPriorityScore: number | null;
  hasVoteHistory: boolean;
};
