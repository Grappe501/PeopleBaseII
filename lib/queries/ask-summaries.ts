import sql from "@/lib/db";
import { listWorkflowTasks } from "@/lib/queries/cm-hub-workflows";
import { getKpiIntelligencePayload } from "@/lib/queries/kpi-intelligence";
import { getPersonById } from "@/lib/queries/people";
import { getPersonCompliance } from "@/lib/queries/compliance";
import type { KpiIntelligencePayload } from "@/lib/types/contracts/kpi-intelligence";

function isPersonUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Campaign KPI + top counties (for /api/ask report `campaign_kpi_snapshot`). */
export async function getCampaignKpiAskPayload(topCountyLimit = 15): Promise<KpiIntelligencePayload> {
  const lim = Math.min(75, Math.max(1, topCountyLimit));
  return getKpiIntelligencePayload(lim);
}

export type WorkflowAskSummary = {
  countsByStatus: Record<string, number>;
  openByDepartment: Record<string, number>;
  nonCompleteTotal: number;
  sampleTasks: Array<{
    id: number;
    title: string;
    department: string;
    status: string;
    owner: string | null;
    dueAt: string | null;
    blockedByDeps: boolean;
  }>;
};

/** Aggregates + compact task sample for /api/ask report `workflow_tasks_summary`. */
export async function getWorkflowTasksSummaryForAsk(sampleLimit = 50): Promise<WorkflowAskSummary> {
  const lim = Math.min(120, Math.max(1, sampleLimit));

  const statusRows = await sql<Array<{ status: string; n: string | number }>>`
    select status, count(*)::bigint as n
    from public.workflow_tasks
    group by status
  `;
  const countsByStatus: Record<string, number> = {};
  for (const r of statusRows) {
    countsByStatus[r.status] = Number(r.n ?? 0);
  }

  const deptRows = await sql<Array<{ department: string; n: string | number }>>`
    select department, count(*)::bigint as n
    from public.workflow_tasks
    where status <> 'complete'
    group by department
  `;
  const openByDepartment: Record<string, number> = {};
  for (const r of deptRows) {
    openByDepartment[r.department] = Number(r.n ?? 0);
  }

  const totalRows = await sql<Array<{ n: string | number }>>`
    select count(*)::bigint as n from public.workflow_tasks where status <> 'complete'
  `;
  const nonCompleteTotal = Number(totalRows[0]?.n ?? 0);

  const list = await listWorkflowTasks({ limit: lim, offset: 0 });
  const sampleTasks = list.rows.map((t) => ({
    id: t.id,
    title: t.title,
    department: t.department,
    status: t.status,
    owner: t.owner,
    dueAt: t.dueAt,
    blockedByDeps: t.isBlockedByDependencies,
  }));

  return {
    countsByStatus,
    openByDepartment,
    nonCompleteTotal,
    sampleTasks,
  };
}

export type MessagingJourneyAskRow = {
  id: string;
  journeyName: string;
  journeyType: string;
  journeyStatus: string;
  enrollmentsActive: number;
  enrollmentsWaitingBranch: number;
  enrollmentsCompleted: number;
  enrollmentsExitedOrSuppressed: number;
  enrollmentsTotal: number;
};

/** Journey list + enrollment rollups for /api/ask report `messaging_journeys_summary`. */
export async function getMessagingJourneysAskSummary(journeyLimit = 25): Promise<{
  journeys: MessagingJourneyAskRow[];
}> {
  const lim = Math.min(50, Math.max(1, journeyLimit));
  try {
    const rows = await sql<
      Array<{
        id: string;
        journey_name: string;
        journey_type: string;
        status: string;
        enrollments_active: string | number;
        enrollments_waiting_branch: string | number;
        enrollments_completed: string | number;
        enrollments_exited: string | number;
        enrollments_total: string | number;
      }>
    >`
      select
        j.id,
        j.journey_name,
        j.journey_type,
        j.status,
        count(e.id) filter (where e.status = 'active')::bigint as enrollments_active,
        count(e.id) filter (where e.status = 'waiting_branch')::bigint as enrollments_waiting_branch,
        count(e.id) filter (where e.status = 'completed')::bigint as enrollments_completed,
        count(e.id) filter (where e.status in ('exited', 'suppressed'))::bigint as enrollments_exited,
        count(e.id)::bigint as enrollments_total
      from public.messaging_journeys j
      left join public.messaging_journey_enrollments e on e.journey_id = j.id
      group by j.id
      order by max(j.created_at) desc
      limit ${lim}
    `;
    return {
      journeys: rows.map((r) => ({
        id: r.id,
        journeyName: r.journey_name,
        journeyType: r.journey_type,
        journeyStatus: r.status,
        enrollmentsActive: Number(r.enrollments_active ?? 0),
        enrollmentsWaitingBranch: Number(r.enrollments_waiting_branch ?? 0),
        enrollmentsCompleted: Number(r.enrollments_completed ?? 0),
        enrollmentsExitedOrSuppressed: Number(r.enrollments_exited ?? 0),
        enrollmentsTotal: Number(r.enrollments_total ?? 0),
      })),
    };
  } catch {
    return { journeys: [] };
  }
}

/** Compact person 360 payload for /api/ask report `person_ask_snapshot`. */
export type PersonAskSnapshot = {
  person: {
    id: string;
    displayName: string | null;
    status: string;
    primaryCountyKey: string | null;
    primaryCountyName: string | null;
    primaryPrecinctLabel: string | null;
    primaryCity: string | null;
    isVoter: boolean;
    isVolunteer: boolean;
    isDonor: boolean;
    isSupporter: boolean;
  };
  compliance: Array<{
    channel: string;
    consentStatus: string;
    isSuppressed: boolean;
    suppressionReason: string | null;
  }>;
  tags: string[];
  recentActivity: Array<{
    activityType: string;
    activitySource: string | null;
    occurredAt: string;
  }>;
  journeyEnrollments: Array<{
    journeyName: string;
    status: string;
    currentStepOrder: number;
    nextStepAt: string | null;
  }>;
  linkedWorkflowTasks: Array<{
    id: number;
    title: string;
    status: string;
    department: string;
    dueAt: string | null;
  }>;
};

/** Person-scoped facts for Ask when `personId` is present (compliance, tags, activity, journeys, tasks). */
export async function getPersonAskSnapshotForAsk(personId: string): Promise<PersonAskSnapshot | null> {
  if (!isPersonUuid(personId)) return null;
  const row = await getPersonById(personId);
  if (!row) return null;

  const [complianceRaw, tags, activity, enrollments, tasks] = await Promise.all([
    getPersonCompliance(personId).catch(() => [] as Awaited<ReturnType<typeof getPersonCompliance>>),
    (async () => {
      try {
        const tagRows = await sql<Array<{ tag_label: string }>>`
          select td.tag_label
          from public.person_tags pt
          join public.tag_definitions td on td.id = pt.tag_id
          where pt.person_id = ${personId}::uuid
          order by pt.assigned_at desc nulls last
          limit 24
        `;
        return tagRows.map((r) => r.tag_label).filter(Boolean);
      } catch {
        return [] as string[];
      }
    })(),
    (async () => {
      try {
        const ar = await sql<
          Array<{
            activity_type: string;
            activity_source: string | null;
            occurred_at: Date | string;
          }>
        >`
          select activity_type, activity_source, occurred_at
          from public.person_activity
          where person_id = ${personId}::uuid
          order by occurred_at desc
          limit 12
        `;
        return ar.map((r) => ({
          activityType: r.activity_type,
          activitySource: r.activity_source,
          occurredAt:
            r.occurred_at instanceof Date
              ? r.occurred_at.toISOString()
              : new Date(r.occurred_at).toISOString(),
        }));
      } catch {
        return [] as PersonAskSnapshot["recentActivity"];
      }
    })(),
    (async () => {
      try {
        const er = await sql<
          Array<{
            journey_name: string;
            status: string;
            current_step_order: number;
            next_step_at: Date | string | null;
          }>
        >`
          select
            j.journey_name,
            e.status,
            e.current_step_order,
            e.next_step_at
          from public.messaging_journey_enrollments e
          join public.messaging_journeys j on j.id = e.journey_id
          where e.person_id = ${personId}::uuid
          order by e.updated_at desc
          limit 18
        `;
        return er.map((r) => ({
          journeyName: r.journey_name,
          status: r.status,
          currentStepOrder: r.current_step_order,
          nextStepAt: r.next_step_at
            ? r.next_step_at instanceof Date
              ? r.next_step_at.toISOString()
              : new Date(r.next_step_at).toISOString()
            : null,
        }));
      } catch {
        return [] as PersonAskSnapshot["journeyEnrollments"];
      }
    })(),
    (async () => {
      try {
        const tr = await sql<
          Array<{
            id: string | number;
            title: string;
            status: string;
            department: string;
            due_at: Date | string | null;
          }>
        >`
          select id, title, status, department, due_at
          from public.workflow_tasks
          where person_id = ${personId}::uuid
          order by
            case when status = 'complete' then 1 else 0 end asc,
            due_at asc nulls last,
            id desc
          limit 15
        `;
        return tr.map((r) => ({
          id: Number(r.id),
          title: r.title,
          status: r.status,
          department: r.department,
          dueAt: r.due_at
            ? r.due_at instanceof Date
              ? r.due_at.toISOString()
              : new Date(r.due_at).toISOString()
            : null,
        }));
      } catch {
        return [] as PersonAskSnapshot["linkedWorkflowTasks"];
      }
    })(),
  ]);

  let countyKey: string | null = null;
  let countyName: string | null = null;
  if (row.primaryCountyId != null) {
    try {
      const gc = await sql<Array<{ county_key: string; county_name: string }>>`
        select county_key, county_name
        from public.geo_counties
        where id = ${row.primaryCountyId}::bigint
        limit 1
      `;
      countyKey = gc[0]?.county_key ?? null;
      countyName = gc[0]?.county_name ?? null;
    } catch {
      /* ignore */
    }
  }

  return {
    person: {
      id: row.id,
      displayName: row.displayName,
      status: row.status,
      primaryCountyKey: countyKey,
      primaryCountyName: countyName,
      primaryPrecinctLabel: row.primaryPrecinctLabel,
      primaryCity: row.primaryCity,
      isVoter: row.isVoter,
      isVolunteer: row.isVolunteer,
      isDonor: row.isDonor,
      isSupporter: row.isSupporter,
    },
    compliance: complianceRaw.map((c) => ({
      channel: c.channel,
      consentStatus: c.consentStatus,
      isSuppressed: c.isSuppressed,
      suppressionReason: c.suppressionReason,
    })),
    tags,
    recentActivity: activity,
    journeyEnrollments: enrollments,
    linkedWorkflowTasks: tasks,
  };
}
