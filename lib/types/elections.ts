export type ElectionRow = {
  id: number;
  electionKey: string;
  electionDate: string | null;
  electionYear: number;
  electionType: string;
  description: string | null;
};

export type RaceRow = {
  id: number;
  electionId: number;
  raceKey: string;
  officeName: string;
  districtType: string | null;
  districtCode: string | null;
  seatName: string | null;
  isPartisan: boolean;
};

export type RaceCandidateRow = {
  id: number;
  raceId: number;
  candidateName: string;
  party: string | null;
  ballotOrder: number | null;
};

export type PrecinctResultRow = {
  id: number;
  raceId: number;
  countyId: number;
  precinctId: number | null;
  sourcePrecinctCode: string | null;
  sourcePrecinctName: string | null;
  candidateName: string;
  party: string | null;
  votes: number;
  totalVotesInRace: number | null;
  voteShare: number | null;
  sourceFile: string | null;
};

export type PrecinctTurnoutRow = {
  id: number;
  electionId: number;
  countyId: number;
  precinctId: number | null;
  sourcePrecinctCode: string | null;
  sourcePrecinctName: string | null;
  registeredVoters: number | null;
  ballotsCast: number | null;
  turnoutRate: number | null;
  sourceFile: string | null;
};

export type ElectionSummary = {
  electionCount: number;
  raceCount: number;
  resultRowCount: number;
  turnoutRowCount: number;
  latestElectionYear: number | null;
};

export type ElectionStatus = {
  tableReady: boolean;
  electionCount: number;
  raceCount: number;
  precinctResultCount: number;
  precinctTurnoutCount: number;
  latestElectionYear: number | null;
};
