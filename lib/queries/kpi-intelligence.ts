import sql from "@/lib/db";
import type { CampaignIntelRow, CountyIntelRow, KpiIntelligencePayload } from "@/lib/types/contracts/kpi-intelligence";

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function iso(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? new Date(0).toISOString() : x.toISOString();
}

type RawCampaign = {
  total_volunteers: string | number | null;
  active_volunteers: string | number | null;
  people_total: string | number | null;
  people_volunteers: string | number | null;
  comms_outbound_7d: string | number | null;
  events_this_week: string | number | null;
  field_contacts_7d: string | number | null;
  open_workflow_tasks: string | number | null;
  blocked_workflow_tasks: string | number | null;
  computed_at: Date | string;
};

function mapCampaign(r: RawCampaign, source: CampaignIntelRow["source"]): CampaignIntelRow {
  return {
    totalVolunteers: num(r.total_volunteers),
    activeVolunteers: num(r.active_volunteers),
    peopleTotal: num(r.people_total),
    peopleVolunteers: num(r.people_volunteers),
    commsOutbound7d: num(r.comms_outbound_7d),
    eventsThisWeek: num(r.events_this_week),
    fieldContacts7d: num(r.field_contacts_7d),
    openWorkflowTasks: num(r.open_workflow_tasks),
    blockedWorkflowTasks: num(r.blocked_workflow_tasks),
    computedAt: iso(r.computed_at),
    source,
  };
}

export async function getCampaignIntelRowPreferMv(): Promise<CampaignIntelRow> {
  try {
    const rows = await sql<RawCampaign[]>`
      select
        total_volunteers,
        active_volunteers,
        people_total,
        people_volunteers,
        comms_outbound_7d,
        events_this_week,
        field_contacts_7d,
        open_workflow_tasks,
        blocked_workflow_tasks,
        computed_at
      from public.kpi_campaign_intelligence_mv
      limit 1
    `;
    const r = rows[0];
    if (r) return mapCampaign(r, "materialized");
  } catch {
    // MV missing or stale deploy — fall back to live view.
  }

  const rows = await sql<RawCampaign[]>`
    select
      total_volunteers,
      active_volunteers,
      people_total,
      people_volunteers,
      comms_outbound_7d,
      events_this_week,
      field_contacts_7d,
      open_workflow_tasks,
      blocked_workflow_tasks,
      computed_at
    from public.kpi_campaign_snapshot_v
    limit 1
  `;
  const r = rows[0];
  if (!r) {
    return {
      totalVolunteers: null,
      activeVolunteers: null,
      peopleTotal: null,
      peopleVolunteers: null,
      commsOutbound7d: null,
      eventsThisWeek: null,
      fieldContacts7d: null,
      openWorkflowTasks: null,
      blockedWorkflowTasks: null,
      computedAt: new Date().toISOString(),
      source: "live_view",
    };
  }
  return mapCampaign(r, "live_view");
}

export async function getTopCountyIntel(limit = 15): Promise<CountyIntelRow[]> {
  const lim = Math.min(75, Math.max(1, limit));
  try {
    const rows = await sql<
      Array<{
        county_id: string | number;
        county_name: string;
        county_key: string | null;
        active_volunteers: string | number;
        open_workflow_tasks: string | number;
        events_next_14d: string | number;
        field_contacts_30d: string | number;
        intel_priority_score: string | number | null;
        target_votes_proportional: string | number | null;
        expected_turnout_votes: string | number | null;
        vr_unique_voters: string | number | null;
        county_vote_share_of_state: string | number | null;
        registrations_window_unique: string | number | null;
      }>
    >`
      select
        county_id,
        county_name,
        county_key,
        active_volunteers,
        open_workflow_tasks,
        events_next_14d,
        field_contacts_30d,
        intel_priority_score,
        target_votes_proportional,
        expected_turnout_votes,
        vr_unique_voters,
        county_vote_share_of_state,
        registrations_window_unique
      from public.kpi_county_intelligence_mv
      order by intel_priority_score desc nulls last, county_name asc
      limit ${lim}
    `;
    return rows.map(
      (r): CountyIntelRow => ({
        countyId: Number(r.county_id),
        countyName: r.county_name,
        countyKey: r.county_key,
        activeVolunteers: Number(r.active_volunteers ?? 0),
        openWorkflowTasks: Number(r.open_workflow_tasks ?? 0),
        eventsNext14d: Number(r.events_next_14d ?? 0),
        fieldContacts30d: Number(r.field_contacts_30d ?? 0),
        intelPriorityScore: num(r.intel_priority_score),
        targetVotesProportional: num(r.target_votes_proportional),
        expectedTurnoutVotes: num(r.expected_turnout_votes),
        vrUniqueVoters: num(r.vr_unique_voters),
        countyVoteShareOfState: num(r.county_vote_share_of_state),
        registrationsWindowUnique: num(r.registrations_window_unique),
      }),
    );
  } catch {
    // MV missing — live join (slower but correct).
    try {
      const rows = await sql<
        Array<{
          county_id: string | number;
          county_name: string;
          county_key: string | null;
          active_volunteers: string | number;
          open_workflow_tasks: string | number;
          events_next_14d: string | number;
          field_contacts_30d: string | number;
          intel_priority_score: string | number | null;
          target_votes_proportional: string | number | null;
          expected_turnout_votes: string | number | null;
          vr_unique_voters: string | number | null;
          county_vote_share_of_state: string | number | null;
          registrations_window_unique: string | number | null;
        }>
      >`
        select
          ks.county_id,
          ks.county_name,
          gc.county_key,
          ks.active_volunteers,
          ks.open_workflow_tasks,
          ks.events_next_14d,
          ks.field_contacts_30d,
          scm.county_priority_score as intel_priority_score,
          scm.county_target_votes_at_proportional_share as target_votes_proportional,
          scm.expected_turnout_votes,
          scm.vr_unique_voters,
          scm.county_vote_share_of_state,
          scm.registrations_2025_11_to_2026_11_unique_voters as registrations_window_unique
        from public.kpi_county_snapshot_v ks
        join public.geo_counties gc on gc.id = ks.county_id
        left join public.statewide_county_master_v scm on scm.county_id = ks.county_id
        order by scm.county_priority_score desc nulls last, ks.county_name asc
        limit ${lim}
      `;
      return rows.map(
        (r): CountyIntelRow => ({
          countyId: Number(r.county_id),
          countyName: r.county_name,
          countyKey: r.county_key,
          activeVolunteers: Number(r.active_volunteers ?? 0),
          openWorkflowTasks: Number(r.open_workflow_tasks ?? 0),
          eventsNext14d: Number(r.events_next_14d ?? 0),
          fieldContacts30d: Number(r.field_contacts_30d ?? 0),
          intelPriorityScore: num(r.intel_priority_score),
          targetVotesProportional: num(r.target_votes_proportional),
          expectedTurnoutVotes: num(r.expected_turnout_votes),
          vrUniqueVoters: num(r.vr_unique_voters),
          countyVoteShareOfState: num(r.county_vote_share_of_state),
          registrationsWindowUnique: num(r.registrations_window_unique),
        }),
      );
    } catch {
      return [];
    }
  }
}

export async function getCountiesActiveCount(): Promise<number> {
  try {
    const rows = await sql<Array<{ n: string | number }>>`
      with
      v as (
        select distinct county_id
        from public.volunteers
        where county_id is not null and volunteer_status = 'active'
      ),
      e as (
        select distinct county_id
        from public.events
        where county_id is not null
          and is_published is true
          and starts_at >= date_trunc('week', now())
          and starts_at < date_trunc('week', now()) + interval '7 days'
      ),
      w as (
        select distinct county_id
        from public.workflow_tasks
        where county_id is not null and status <> 'complete'
      )
      select count(*)::bigint as n
      from (
        select county_id from v
        union
        select county_id from e
        union
        select county_id from w
      ) x
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function getKpiIntelligencePayload(topLimit = 15): Promise<KpiIntelligencePayload> {
  const [campaign, topCounties] = await Promise.all([
    getCampaignIntelRowPreferMv(),
    getTopCountyIntel(topLimit),
  ]);
  return {
    campaign,
    topCounties,
    topCountiesLimit: topLimit,
  };
}
