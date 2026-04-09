export type CmAgentOnboardingRow = {
  id: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  campaignPhilosophy: string | null;
  focuses: string | null;
  prioritiesJson: unknown | null;
  styleGuide: string | null;
  decisionRules: string | null;
  weeklyHoursAvailable: number | null;
  preferredCheckinCadence: string | null;
  constraints: string | null;
  agentRoutingNotes: string | null;
};

export type CmAgentOnboardingSaveInput = {
  createdBy?: string | null;
  campaignPhilosophy?: string | null;
  focuses?: string | null;
  prioritiesJson?: Record<string, unknown> | null;
  styleGuide?: string | null;
  decisionRules?: string | null;
  weeklyHoursAvailable?: number | null;
  preferredCheckinCadence?: string | null;
  constraints?: string | null;
  agentRoutingNotes?: string | null;
};

