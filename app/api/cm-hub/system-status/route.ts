import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { SystemStatusModule, SystemStatusPayload, SystemStatusTone } from "@/lib/types/contracts/system-status";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function toneFromChecks(checks: Array<{ ok: boolean }>): SystemStatusTone {
  const total = checks.length;
  const okCount = checks.filter((c) => c.ok).length;
  if (total === 0) return "neutral";
  if (okCount === total) return "success";
  if (okCount === 0) return "danger";
  return "warning";
}

async function regclassExists(qualified: string): Promise<boolean> {
  const rows = await sql<Array<{ ok: boolean }>>`
    select to_regclass(${qualified}) is not null as ok
  `;
  return Boolean(rows[0]?.ok);
}

async function safeCountPeople(): Promise<number | null> {
  try {
    const rows = await sql<Array<{ n: string | number }>>`
      select count(*)::bigint as n from public.people
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

async function safeCountVolunteers(): Promise<number | null> {
  try {
    const rows = await sql<Array<{ n: string | number }>>`
      select count(*)::bigint as n from public.volunteers
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse<ApiResponse<SystemStatusPayload>>> {
  try {
    // Core existence checks (use to_regclass so missing objects don't throw)
    const checks = {
      volunteers: await regclassExists("public.volunteers"),
      workflowTasks: await regclassExists("public.workflow_tasks"),
      workflowDeps: await regclassExists("public.workflow_task_dependencies"),
      people: await regclassExists("public.people"),
      peopleMasterV: await regclassExists("public.people_master_v"),
      events: await regclassExists("public.events"),
      eventsRollupV: await regclassExists("public.events_rollup_v"),
      fieldSessions: await regclassExists("public.canvass_sessions"),
      fieldResponses: await regclassExists("public.canvass_responses"),
      countyMasterV: await regclassExists("public.statewide_county_master_v"),
      precinctPriorityV: await regclassExists("public.statewide_precinct_priority_v"),
      reengagementV: await regclassExists("public.statewide_voter_reengagement_v"),
      kpiCampaignV: await regclassExists("public.kpi_campaign_snapshot_v"),
      kpiCountyV: await regclassExists("public.kpi_county_snapshot_v"),
      kpiCampaignMv: await regclassExists("public.kpi_campaign_intelligence_mv"),
      kpiCountyMv: await regclassExists("public.kpi_county_intelligence_mv"),
      commsTemplates: await regclassExists("public.comms_templates"),
      commsQueue: await regclassExists("public.comms_queue"),
      commsWebhooks: await regclassExists("public.comms_webhook_events"),
      messagingJourneys: await regclassExists("public.messaging_journeys"),
      messagingEngagementEvents: await regclassExists("public.messaging_engagement_events"),
      personCommunicationHistory: await regclassExists("public.person_communication_history"),
      complianceMessageLog: await regclassExists("public.compliance_message_log"),
      deliverabilityThresholdConfigs: await regclassExists("public.deliverability_threshold_configs"),
    };

    const modules: SystemStatusModule[] = [
      {
        key: "kpi",
        name: "KPI spine",
        summary: "Rollups powering CM Hub and drilldowns.",
        checks: [
          { key: "kpi_campaign_snapshot_v", label: "Campaign snapshot view", kind: "view", expectedName: "public.kpi_campaign_snapshot_v", ok: checks.kpiCampaignV },
          { key: "kpi_county_snapshot_v", label: "County snapshot view", kind: "view", expectedName: "public.kpi_county_snapshot_v", ok: checks.kpiCountyV },
          { key: "kpi_campaign_intelligence_mv", label: "Campaign intel MV", kind: "view", expectedName: "public.kpi_campaign_intelligence_mv", ok: checks.kpiCampaignMv },
          { key: "kpi_county_intelligence_mv", label: "County intel MV", kind: "view", expectedName: "public.kpi_county_intelligence_mv", ok: checks.kpiCountyMv },
          { key: "kpi_intel_api", label: "KPI intelligence API", kind: "api", expectedName: "GET /api/intelligence/kpi", ok: true },
          { key: "cmhub_overview_api", label: "CM Hub overview API", kind: "api", expectedName: "GET /api/cm-hub/overview", ok: true },
        ],
        tone: "neutral",
        metrics: {
          activeVolunteers: checks.kpiCampaignV ? null : null,
        },
      },
      {
        key: "people",
        name: "People (unified)",
        summary: "Canonical people records + identity resolution scaffolding.",
        checks: [
          { key: "people", label: "People table", kind: "table", expectedName: "public.people", ok: checks.people },
          { key: "people_master_v", label: "People master view", kind: "view", expectedName: "public.people_master_v", ok: checks.peopleMasterV },
          { key: "people_search_api", label: "People search API", kind: "api", expectedName: "GET /api/people/search", ok: true },
          { key: "people_360_page", label: "Person 360 page", kind: "page", expectedName: "/people/[personId]", ok: true },
        ],
        tone: "neutral",
        metrics: {
          peopleRows: checks.people ? await safeCountPeople() : null,
        },
      },
      {
        key: "workflows",
        name: "Workflows",
        summary: "Tasks + dependencies + links to campaign objects.",
        checks: [
          { key: "workflow_tasks", label: "Workflow tasks table", kind: "table", expectedName: "public.workflow_tasks", ok: checks.workflowTasks },
          { key: "workflow_task_dependencies", label: "Dependencies table", kind: "table", expectedName: "public.workflow_task_dependencies", ok: checks.workflowDeps },
          { key: "workflows_page", label: "Workflows UI", kind: "page", expectedName: "/cm-hub/workflows", ok: true },
        ],
        tone: "neutral",
        metrics: {
          openTasks: checks.workflowTasks
            ? Number(
                (await sql<Array<{ n: string | number }>>`
                  select count(*)::bigint as n
                  from public.workflow_tasks
                  where status <> 'complete'
                `)[0]?.n ?? 0,
              )
            : null,
        },
      },
      {
        key: "events",
        name: "Events",
        summary: "Statewide calendar with upstream rollups + approvals.",
        checks: [
          { key: "events", label: "Events table", kind: "table", expectedName: "public.events", ok: checks.events },
          { key: "events_rollup_v", label: "Events rollup view", kind: "view", expectedName: "public.events_rollup_v", ok: checks.eventsRollupV },
          { key: "calendar_admin", label: "Calendar admin UI", kind: "page", expectedName: "/command-center/calendar", ok: true },
        ],
        tone: "neutral",
        metrics: {
          upcomingEvents: checks.events
            ? Number(
                (await sql<Array<{ n: string | number }>>`
                  select count(*)::bigint as n
                  from public.events
                  where is_published is true
                    and starts_at >= now()
                    and starts_at < now() + interval '14 days'
                `)[0]?.n ?? 0,
              )
            : null,
        },
      },
      {
        key: "comms",
        name: "Communications (v1)",
        summary: "Templates, approval queue, orchestrated journeys, compliance log, webhooks.",
        checks: [
          { key: "comms_templates", label: "Templates table", kind: "table", expectedName: "public.comms_templates", ok: checks.commsTemplates },
          { key: "comms_queue", label: "Queue table", kind: "table", expectedName: "public.comms_queue", ok: checks.commsQueue },
          { key: "comms_webhook_events", label: "Webhook inbox", kind: "table", expectedName: "public.comms_webhook_events", ok: checks.commsWebhooks },
          { key: "compliance_message_log", label: "Compliance message log", kind: "table", expectedName: "public.compliance_message_log", ok: checks.complianceMessageLog },
          { key: "messaging_journeys", label: "Messaging journeys", kind: "table", expectedName: "public.messaging_journeys", ok: checks.messagingJourneys },
          { key: "messaging_engagement_events", label: "Messaging engagement events", kind: "table", expectedName: "public.messaging_engagement_events", ok: checks.messagingEngagementEvents },
          { key: "person_communication_history", label: "Person communication history", kind: "table", expectedName: "public.person_communication_history", ok: checks.personCommunicationHistory },
          {
            key: "deliverability_threshold_configs",
            label: "Deliverability threshold configs",
            kind: "table",
            expectedName: "public.deliverability_threshold_configs",
            ok: checks.deliverabilityThresholdConfigs,
          },
          { key: "messaging_orchestrator_tick", label: "Orchestrator tick API", kind: "api", expectedName: "POST /api/messaging/orchestrator/tick", ok: true },
          { key: "deliverability_thresholds_api", label: "Deliverability thresholds API", kind: "api", expectedName: "GET /api/messaging/deliverability/thresholds", ok: true },
          { key: "comms_ui", label: "Comms dashboard", kind: "page", expectedName: "/cm-hub/comms", ok: true },
        ],
        tone: "neutral",
        metrics: {
          queueOpen: checks.commsQueue
            ? Number(
                (await sql<Array<{ n: string | number }>>`
                  select count(*)::bigint as n
                  from public.comms_queue
                  where status not in ('sent', 'rejected', 'blocked_compliance')
                `)[0]?.n ?? 0,
              )
            : null,
        },
      },
      {
        key: "volunteers",
        name: "Volunteers",
        summary: "Volunteer OS core tables + basic dashboards.",
        checks: [
          { key: "volunteers", label: "Volunteers table", kind: "table", expectedName: "public.volunteers", ok: checks.volunteers },
          { key: "volunteers_dashboard", label: "Volunteers dashboard", kind: "page", expectedName: "/volunteers/dashboard", ok: true },
        ],
        tone: "neutral",
        metrics: {
          volunteersRows: checks.volunteers ? await safeCountVolunteers() : null,
        },
      },
      {
        key: "field",
        name: "Field (mobile + data)",
        summary: "Turfing + sessions + contact outcomes (mobile app).",
        checks: [
          { key: "canvass_sessions", label: "Canvass sessions table", kind: "table", expectedName: "public.canvass_sessions", ok: checks.fieldSessions },
          { key: "canvass_responses", label: "Canvass responses table", kind: "table", expectedName: "public.canvass_responses", ok: checks.fieldResponses },
          { key: "field_mobile", label: "Field mobile app", kind: "page", expectedName: "/field/mobile", ok: true },
        ],
        tone: "neutral",
        metrics: {
          responses7d: checks.fieldResponses
            ? Number(
                (await sql<Array<{ n: string | number }>>`
                  select count(*)::bigint as n
                  from public.canvass_responses
                  where created_at >= now() - interval '7 days'
                `)[0]?.n ?? 0,
              )
            : null,
        },
      },
      {
        key: "county_intel",
        name: "County / precinct intelligence",
        summary: "Statewide county master + precinct priority + re-engagement layer.",
        checks: [
          { key: "statewide_county_master_v", label: "County master view", kind: "view", expectedName: "public.statewide_county_master_v", ok: checks.countyMasterV },
          { key: "statewide_precinct_priority_v", label: "Precinct priority view", kind: "view", expectedName: "public.statewide_precinct_priority_v", ok: checks.precinctPriorityV },
          { key: "statewide_voter_reengagement_v", label: "Voter re-engagement view", kind: "view", expectedName: "public.statewide_voter_reengagement_v", ok: checks.reengagementV },
          { key: "counties_page", label: "Counties UI", kind: "page", expectedName: "/counties", ok: true },
        ],
        tone: "neutral",
        metrics: {
          counties: checks.countyMasterV
            ? Number(
                (await sql<Array<{ n: string | number }>>`
                  select count(*)::bigint as n
                  from public.statewide_county_master_v
                `)[0]?.n ?? 0,
              )
            : null,
        },
      },
    ];

    for (const m of modules) {
      m.tone = toneFromChecks(m.checks);
    }

    const overallTone: SystemStatusTone =
      modules.some((m) => m.tone === "danger")
        ? "danger"
        : modules.some((m) => m.tone === "warning")
          ? "warning"
          : modules.every((m) => m.tone === "success")
            ? "success"
            : "neutral";

    const payload: SystemStatusPayload = {
      computedAt: new Date().toISOString(),
      overallTone,
      modules,
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

