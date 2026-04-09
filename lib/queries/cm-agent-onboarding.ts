import sql from "@/lib/db";
import type { CmAgentOnboardingRow, CmAgentOnboardingSaveInput } from "@/lib/types/contracts/cm-agent-onboarding";

function iso(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : new Date(value ?? "");
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function mapRow(r: {
  id: string | number;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string | null;
  campaign_philosophy: string | null;
  focuses: string | null;
  priorities_json: unknown | null;
  style_guide: string | null;
  decision_rules: string | null;
  weekly_hours_available: string | number | null;
  preferred_checkin_cadence: string | null;
  constraints: string | null;
  agent_routing_notes: string | null;
}): CmAgentOnboardingRow {
  return {
    id: Number(r.id),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    createdBy: r.created_by,
    campaignPhilosophy: r.campaign_philosophy,
    focuses: r.focuses,
    prioritiesJson: r.priorities_json ?? null,
    styleGuide: r.style_guide,
    decisionRules: r.decision_rules,
    weeklyHoursAvailable: r.weekly_hours_available != null ? Number(r.weekly_hours_available) : null,
    preferredCheckinCadence: r.preferred_checkin_cadence,
    constraints: r.constraints,
    agentRoutingNotes: r.agent_routing_notes,
  };
}

export async function getLatestCmAgentOnboarding(): Promise<CmAgentOnboardingRow | null> {
  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      updated_at: Date | string;
      created_by: string | null;
      campaign_philosophy: string | null;
      focuses: string | null;
      priorities_json: unknown | null;
      style_guide: string | null;
      decision_rules: string | null;
      weekly_hours_available: string | number | null;
      preferred_checkin_cadence: string | null;
      constraints: string | null;
      agent_routing_notes: string | null;
    }>
  >`
    select
      id, created_at, updated_at, created_by,
      campaign_philosophy, focuses, priorities_json, style_guide, decision_rules,
      weekly_hours_available, preferred_checkin_cadence, constraints, agent_routing_notes
    from public.cm_agent_onboarding
    order by updated_at desc, id desc
    limit 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function saveCmAgentOnboarding(input: CmAgentOnboardingSaveInput): Promise<CmAgentOnboardingRow> {
  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      updated_at: Date | string;
      created_by: string | null;
      campaign_philosophy: string | null;
      focuses: string | null;
      priorities_json: unknown | null;
      style_guide: string | null;
      decision_rules: string | null;
      weekly_hours_available: string | number | null;
      preferred_checkin_cadence: string | null;
      constraints: string | null;
      agent_routing_notes: string | null;
    }>
  >`
    insert into public.cm_agent_onboarding (
      created_by,
      campaign_philosophy,
      focuses,
      priorities_json,
      style_guide,
      decision_rules,
      weekly_hours_available,
      preferred_checkin_cadence,
      constraints,
      agent_routing_notes,
      updated_at
    ) values (
      ${input.createdBy ?? null},
      ${input.campaignPhilosophy ?? null},
      ${input.focuses ?? null},
      ${input.prioritiesJson != null ? sql.json(input.prioritiesJson as any) : null},
      ${input.styleGuide ?? null},
      ${input.decisionRules ?? null},
      ${input.weeklyHoursAvailable ?? null},
      ${input.preferredCheckinCadence ?? null},
      ${input.constraints ?? null},
      ${input.agentRoutingNotes ?? null},
      now()
    )
    returning
      id, created_at, updated_at, created_by,
      campaign_philosophy, focuses, priorities_json, style_guide, decision_rules,
      weekly_hours_available, preferred_checkin_cadence, constraints, agent_routing_notes
  `;
  return mapRow(rows[0]!);
}

