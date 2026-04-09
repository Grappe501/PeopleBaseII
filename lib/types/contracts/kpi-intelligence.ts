export type CampaignIntelRow = {
  totalVolunteers: number | null;
  activeVolunteers: number | null;
  peopleTotal: number | null;
  peopleVolunteers: number | null;
  commsOutbound7d: number | null;
  eventsThisWeek: number | null;
  fieldContacts7d: number | null;
  openWorkflowTasks: number | null;
  blockedWorkflowTasks: number | null;
  computedAt: string;
  source: "materialized" | "live_view";
};

export type CountyIntelRow = {
  countyId: number;
  countyName: string;
  countyKey: string | null;
  activeVolunteers: number;
  openWorkflowTasks: number;
  eventsNext14d: number;
  fieldContacts30d: number;
  intelPriorityScore: number | null;
  targetVotesProportional: number | null;
  expectedTurnoutVotes: number | null;
  vrUniqueVoters: number | null;
  countyVoteShareOfState: number | null;
  registrationsWindowUnique: number | null;
};

export type KpiIntelligencePayload = {
  campaign: CampaignIntelRow;
  topCounties: CountyIntelRow[];
  topCountiesLimit: number;
};
