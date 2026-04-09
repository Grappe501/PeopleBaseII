export type Cd2CountyIntelRow = {
  countyId: string | number;
  countyName: string | null;
  countyObservedDem2024Pct: number | null;
  modelExpectedDemPct: number | null;
  countyDemResidualPct: number | null;
  countyModelBucket: string | null;
  pctBlackPopulation: number | null;
  povertyRatePct: number | null;
  blsUnemploymentRatePct: number | null;
};

export type Cd2PrecinctIntelRow = {
  countyId: string | number;
  countyName: string | null;
  precinctLabel: string | null;
  registeredVoters: number | null;
  baselineDemPct: number | null;
  modelExpectedDemPct: number | null;
  countyObservedDem2024Pct: number | null;
  countyDemResidualPct: number | null;
  precinctVsCountyGapPct: number | null;
  precinctHeadroomToModelPct: number | null;
  blankDensityScore: number | null;
  estimatedDemVotesIfPrecinctMatchedModel: number | null;
  voterModelArchetype: string | null;
};

export type Cd2IntelSummary = {
  counties: Cd2CountyIntelRow[];
  topPrecinctsByBlankDensity: Cd2PrecinctIntelRow[];
  stats: {
    cd2CountyCount: number;
    countiesUnderperformingModel: number;
  };
};

export type AskReportId =
  | "cd2_county_intel"
  | "cd2_precinct_intel"
  | "cd2_target_precincts"
  | "cd2_intel_summary"
  | "cd2_segment_summary"
  | "campaign_kpi_snapshot"
  | "workflow_tasks_summary"
  | "messaging_journeys_summary"
  | "person_ask_snapshot";

/** JSON router must use these exact strings */
export const ASK_REPORT_IDS: AskReportId[] = [
  "cd2_intel_summary",
  "cd2_county_intel",
  "cd2_precinct_intel",
  "cd2_target_precincts",
  "cd2_segment_summary",
  "campaign_kpi_snapshot",
  "workflow_tasks_summary",
  "messaging_journeys_summary",
  "person_ask_snapshot",
];
