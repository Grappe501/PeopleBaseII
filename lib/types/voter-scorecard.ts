export type Cd2SegmentSummaryRow = {
  segmentBucket: string;
  voterCount: number;
};

export type Cd2SegmentHotspotRow = {
  countyId: string | number;
  countyName: string | null;
  precinctLabel: string | null;
  segmentBucket: string | null;
  voterCount: number;
  segmentSharePer1kRegistrants: number | null;
};

export type Cd2VoterScorecardRow = {
  voterId: string | null;
  keyRegistrant: string | null;
  countyId: string | number;
  countyName: string | null;
  precinctLabel: string | null;
  demLeanScore: number | null;
  campaignEngagementScore: number | null;
  funderPotentialProxyScore: number | null;
  segmentBucket: string | null;
  initiativeBreadth: number | null;
};
