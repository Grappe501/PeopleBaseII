import sql from "@/lib/db";
import type {
  MessagingAudienceRow,
  MessagingJourneyEnrollmentRow,
  MessagingJourneyRow,
  MessagingJourneyStepRow,
  MessagingObjectiveRow,
} from "@/lib/types/contracts/messaging-orchestration";

function iso(d: Date | string | null): string | null {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

export async function listMessagingObjectives(): Promise<MessagingObjectiveRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      objective_key: string;
      name: string;
      description: string | null;
      created_at: Date | string;
    }>
  >`
    select id, objective_key, name, description, created_at
    from public.messaging_objectives
    order by name asc
  `;
  return rows.map((r) => ({
    id: r.id,
    objectiveKey: r.objective_key,
    name: r.name,
    description: r.description,
    createdAt: iso(r.created_at) ?? "",
  }));
}

export async function createMessagingObjective(input: {
  objectiveKey: string;
  name: string;
  description?: string | null;
}): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    insert into public.messaging_objectives (objective_key, name, description)
    values (${input.objectiveKey}, ${input.name}, ${input.description ?? null})
    on conflict (objective_key) do update set
      name = excluded.name,
      description = excluded.description,
      updated_at = now()
    returning id
  `;
  return rows[0]?.id ?? null;
}

export async function listMessagingJourneys(): Promise<MessagingJourneyRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      objective_id: string | null;
      audience_id: string | null;
      journey_name: string;
      journey_type: string;
      status: string;
      start_date: Date | string | null;
      end_date: Date | string | null;
      created_by: string | null;
      created_at: Date | string;
    }>
  >`
    select
      id,
      objective_id,
      audience_id,
      journey_name,
      journey_type,
      status,
      start_date,
      end_date,
      created_by,
      created_at
    from public.messaging_journeys
    order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    objectiveId: r.objective_id,
    audienceId: r.audience_id,
    journeyName: r.journey_name,
    journeyType: r.journey_type as MessagingJourneyRow["journeyType"],
    status: r.status as MessagingJourneyRow["status"],
    startDate: iso(r.start_date),
    endDate: iso(r.end_date),
    createdBy: r.created_by,
    createdAt: iso(r.created_at) ?? "",
  }));
}

export async function getMessagingJourney(journeyId: string): Promise<MessagingJourneyRow | null> {
  const rows = await sql<
    Array<{
      id: string;
      objective_id: string | null;
      audience_id: string | null;
      journey_name: string;
      journey_type: string;
      status: string;
      start_date: Date | string | null;
      end_date: Date | string | null;
      created_by: string | null;
      created_at: Date | string;
    }>
  >`
    select
      id,
      objective_id,
      audience_id,
      journey_name,
      journey_type,
      status,
      start_date,
      end_date,
      created_by,
      created_at
    from public.messaging_journeys
    where id = ${journeyId}::uuid
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    objectiveId: r.objective_id,
    audienceId: r.audience_id,
    journeyName: r.journey_name,
    journeyType: r.journey_type as MessagingJourneyRow["journeyType"],
    status: r.status as MessagingJourneyRow["status"],
    startDate: iso(r.start_date),
    endDate: iso(r.end_date),
    createdBy: r.created_by,
    createdAt: iso(r.created_at) ?? "",
  };
}

export async function createMessagingJourney(input: {
  journeyName: string;
  journeyType: MessagingJourneyRow["journeyType"];
  objectiveId?: string | null;
  audienceId?: string | null;
  status?: MessagingJourneyRow["status"];
  createdBy?: string | null;
}): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    insert into public.messaging_journeys (
      journey_name,
      journey_type,
      objective_id,
      audience_id,
      status,
      created_by
    ) values (
      ${input.journeyName},
      ${input.journeyType},
      ${input.objectiveId ?? null}::uuid,
      ${input.audienceId ?? null}::uuid,
      ${input.status ?? "draft"},
      ${input.createdBy ?? null}
    )
    returning id
  `;
  return rows[0]?.id ?? null;
}

export async function updateMessagingJourney(
  journeyId: string,
  patch: Partial<{
    journeyName: string;
    journeyType: MessagingJourneyRow["journeyType"];
    objectiveId: string | null;
    audienceId: string | null;
    status: MessagingJourneyRow["status"];
    startDate: string | null;
    endDate: string | null;
  }>,
): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true;
  const current = await getMessagingJourney(journeyId);
  if (!current) return false;
  const journeyName = patch.journeyName ?? current.journeyName;
  const journeyType = patch.journeyType ?? current.journeyType;
  const objectiveId = patch.objectiveId !== undefined ? patch.objectiveId : current.objectiveId;
  const audienceId = patch.audienceId !== undefined ? patch.audienceId : current.audienceId;
  const status = patch.status ?? current.status;
  const startDate = patch.startDate !== undefined ? patch.startDate : current.startDate;
  const endDate = patch.endDate !== undefined ? patch.endDate : current.endDate;
  const rows = await sql<Array<{ id: string }>>`
    update public.messaging_journeys
    set
      journey_name = ${journeyName},
      journey_type = ${journeyType},
      objective_id = ${objectiveId}::uuid,
      audience_id = ${audienceId}::uuid,
      status = ${status},
      start_date = ${startDate}::timestamptz,
      end_date = ${endDate}::timestamptz,
      updated_at = now()
    where id = ${journeyId}::uuid
    returning id
  `;
  return rows.length > 0;
}

export async function listJourneySteps(journeyId: string): Promise<MessagingJourneyStepRow[]> {
  const rows = await sql<
    Array<{
      id: string | number;
      journey_id: string;
      step_order: number;
      step_type: string;
      channel: string | null;
      template_key: string | null;
      delay_after_previous_value: number | null;
      delay_after_previous_unit: string | null;
      condition_logic: unknown;
      audience_filter_override: unknown;
      requires_approval: boolean;
    }>
  >`
    select
      id,
      journey_id,
      step_order,
      step_type,
      channel,
      template_key,
      delay_after_previous_value,
      delay_after_previous_unit,
      condition_logic,
      audience_filter_override,
      requires_approval
    from public.messaging_journey_steps
    where journey_id = ${journeyId}::uuid
    order by step_order asc
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    journeyId: r.journey_id,
    stepOrder: r.step_order,
    stepType: r.step_type as MessagingJourneyStepRow["stepType"],
    channel: r.channel as MessagingJourneyStepRow["channel"],
    templateKey: r.template_key,
    delayAfterPreviousValue: r.delay_after_previous_value,
    delayAfterPreviousUnit: r.delay_after_previous_unit as MessagingJourneyStepRow["delayAfterPreviousUnit"],
    conditionLogic: (r.condition_logic ?? null) as MessagingJourneyStepRow["conditionLogic"],
    audienceFilterOverride: (r.audience_filter_override ?? null) as MessagingJourneyStepRow["audienceFilterOverride"],
    requiresApproval: r.requires_approval,
  }));
}

export async function createJourneyStep(input: {
  journeyId: string;
  stepOrder: number;
  stepType: MessagingJourneyStepRow["stepType"];
  channel?: MessagingJourneyStepRow["channel"] | null;
  templateKey?: string | null;
  delayAfterPreviousValue?: number | null;
  delayAfterPreviousUnit?: MessagingJourneyStepRow["delayAfterPreviousUnit"] | null;
  conditionLogic?: unknown;
  audienceFilterOverride?: unknown;
  requiresApproval?: boolean;
}): Promise<number | null> {
  const rows = await sql<Array<{ id: string | number }>>`
    insert into public.messaging_journey_steps (
      journey_id,
      step_order,
      step_type,
      channel,
      template_key,
      delay_after_previous_value,
      delay_after_previous_unit,
      condition_logic,
      audience_filter_override,
      requires_approval
    ) values (
      ${input.journeyId}::uuid,
      ${input.stepOrder},
      ${input.stepType},
      ${input.channel ?? null},
      ${input.templateKey ?? null},
      ${input.delayAfterPreviousValue ?? 0},
      ${input.delayAfterPreviousUnit ?? null},
      ${input.conditionLogic != null ? sql.json(input.conditionLogic as never) : null},
      ${input.audienceFilterOverride != null ? sql.json(input.audienceFilterOverride as never) : null},
      ${input.requiresApproval ?? true}
    )
    on conflict (journey_id, step_order) do update set
      step_type = excluded.step_type,
      channel = excluded.channel,
      template_key = excluded.template_key,
      delay_after_previous_value = excluded.delay_after_previous_value,
      delay_after_previous_unit = excluded.delay_after_previous_unit,
      condition_logic = excluded.condition_logic,
      audience_filter_override = excluded.audience_filter_override,
      requires_approval = excluded.requires_approval,
      updated_at = now()
    returning id
  `;
  return rows[0] != null ? Number(rows[0].id) : null;
}

export async function listMessagingAudiences(): Promise<MessagingAudienceRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      name: string;
      query_definition: unknown;
      is_dynamic: boolean;
      estimated_size: number | null;
      last_evaluated_at: Date | string | null;
      created_at: Date | string;
    }>
  >`
    select id, name, query_definition, is_dynamic, estimated_size, last_evaluated_at, created_at
    from public.messaging_audiences
    order by name asc
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    queryDefinition: (r.query_definition ?? {}) as MessagingAudienceRow["queryDefinition"],
    isDynamic: r.is_dynamic,
    estimatedSize: r.estimated_size,
    lastEvaluatedAt: iso(r.last_evaluated_at),
    createdAt: iso(r.created_at) ?? "",
  }));
}

export async function createMessagingAudience(input: {
  name: string;
  queryDefinition?: unknown;
  isDynamic?: boolean;
}): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    insert into public.messaging_audiences (name, query_definition, is_dynamic)
    values (${input.name}, ${sql.json((input.queryDefinition ?? {}) as never)}, ${input.isDynamic ?? true})
    returning id
  `;
  return rows[0]?.id ?? null;
}

export async function enrollInJourney(input: {
  personId: string;
  journeyId: string;
  nextStepAt?: Date;
}): Promise<number | null> {
  const next = input.nextStepAt ?? new Date();
  const rows = await sql<Array<{ id: string | number }>>`
    insert into public.messaging_journey_enrollments (
      person_id,
      journey_id,
      current_step_order,
      status,
      next_step_at
    )
    select
      ${input.personId}::uuid,
      ${input.journeyId}::uuid,
      1,
      'active',
      ${next}::timestamptz
    where not exists (
      select 1
      from public.messaging_journey_enrollments e
      where e.person_id = ${input.personId}::uuid
        and e.journey_id = ${input.journeyId}::uuid
        and e.status in ('active', 'waiting_branch')
    )
    returning id
  `;
  if (rows[0]) return Number(rows[0].id);
  const existing = await sql<Array<{ id: string | number }>>`
    select id from public.messaging_journey_enrollments
    where person_id = ${input.personId}::uuid
      and journey_id = ${input.journeyId}::uuid
      and status = 'active'
    limit 1
  `;
  return existing[0] != null ? Number(existing[0].id) : null;
}

export async function listEnrollmentsForJourney(
  journeyId: string,
  limit = 100,
): Promise<MessagingJourneyEnrollmentRow[]> {
  const lim = Math.min(500, Math.max(1, limit));
  const rows = await sql<
    Array<{
      id: string | number;
      person_id: string;
      journey_id: string;
      current_step_order: number;
      status: string;
      last_step_at: Date | string | null;
      next_step_at: Date | string;
      metadata: unknown;
    }>
  >`
    select id, person_id, journey_id, current_step_order, status, last_step_at, next_step_at, metadata
    from public.messaging_journey_enrollments
    where journey_id = ${journeyId}::uuid
    order by next_step_at asc
    limit ${lim}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    personId: r.person_id,
    journeyId: r.journey_id,
    currentStepOrder: r.current_step_order,
    status: r.status as MessagingJourneyEnrollmentRow["status"],
    lastStepAt: iso(r.last_step_at),
    nextStepAt: iso(r.next_step_at) ?? "",
    metadata: (r.metadata ?? {}) as MessagingJourneyEnrollmentRow["metadata"],
  }));
}

export async function listDueEnrollments(limit = 50): Promise<
  Array<{
    enrollment: MessagingJourneyEnrollmentRow;
    journeyStatus: string;
  }>
> {
  const lim = Math.min(200, Math.max(1, limit));
  const rows = await sql<
    Array<{
      id: string | number;
      person_id: string;
      journey_id: string;
      current_step_order: number;
      status: string;
      last_step_at: Date | string | null;
      next_step_at: Date | string;
      metadata: unknown;
      jstatus: string;
    }>
  >`
    select
      e.id,
      e.person_id,
      e.journey_id,
      e.current_step_order,
      e.status,
      e.last_step_at,
      e.next_step_at,
      e.metadata,
      j.status as jstatus
    from public.messaging_journey_enrollments e
    inner join public.messaging_journeys j on j.id = e.journey_id
    where j.status = 'active'
      and e.next_step_at <= now()
      and e.status in ('active', 'waiting_branch')
    order by e.next_step_at asc
    limit ${lim}
  `;
  return rows.map((r) => ({
    enrollment: {
      id: Number(r.id),
      personId: r.person_id,
      journeyId: r.journey_id,
      currentStepOrder: r.current_step_order,
      status: r.status as MessagingJourneyEnrollmentRow["status"],
      lastStepAt: iso(r.last_step_at),
      nextStepAt: iso(r.next_step_at) ?? "",
      metadata: (r.metadata ?? {}) as MessagingJourneyEnrollmentRow["metadata"],
    },
    journeyStatus: r.jstatus,
  }));
}

export async function getMessagingEnrollment(enrollmentId: number): Promise<MessagingJourneyEnrollmentRow | null> {
  const rows = await sql<
    Array<{
      id: string | number;
      person_id: string;
      journey_id: string;
      current_step_order: number;
      status: string;
      last_step_at: Date | string | null;
      next_step_at: Date | string;
      metadata: unknown;
    }>
  >`
    select id, person_id, journey_id, current_step_order, status, last_step_at, next_step_at, metadata
    from public.messaging_journey_enrollments
    where id = ${enrollmentId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    personId: r.person_id,
    journeyId: r.journey_id,
    currentStepOrder: r.current_step_order,
    status: r.status as MessagingJourneyEnrollmentRow["status"],
    lastStepAt: iso(r.last_step_at),
    nextStepAt: iso(r.next_step_at) ?? "",
    metadata: (r.metadata ?? {}) as MessagingJourneyEnrollmentRow["metadata"],
  };
}

export async function updateEnrollment(
  enrollmentId: number,
  patch: Partial<{
    currentStepOrder: number;
    status: MessagingJourneyEnrollmentRow["status"];
    lastStepAt: Date | null;
    nextStepAt: Date;
    metadata: Record<string, unknown>;
  }>,
): Promise<boolean> {
  const current = await getMessagingEnrollment(enrollmentId);
  if (!current) return false;
  const lastStepAt =
    patch.lastStepAt !== undefined
      ? patch.lastStepAt
      : current.lastStepAt != null
        ? new Date(current.lastStepAt)
        : null;
  const nextStepAt = patch.nextStepAt ?? new Date(current.nextStepAt);
  const rows = await sql<Array<{ id: string | number }>>`
    update public.messaging_journey_enrollments
    set
      current_step_order = ${patch.currentStepOrder ?? current.currentStepOrder},
      status = ${patch.status ?? current.status},
      last_step_at = ${lastStepAt},
      next_step_at = ${nextStepAt},
      metadata = ${sql.json((patch.metadata ?? current.metadata) as never)},
      updated_at = now()
    where id = ${enrollmentId}
    returning id
  `;
  return rows.length > 0;
}

export async function logJourneyCompliance(input: {
  personId: string;
  journeyId: string;
  journeyStepId: number | null;
  enrollmentId: number | null;
  action: "passed" | "blocked" | "skipped" | "rerouted" | "suppressed_exit";
  channel?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    insert into public.messaging_journey_compliance_logs (
      person_id,
      journey_id,
      journey_step_id,
      enrollment_id,
      action,
      channel,
      reason,
      metadata
    ) values (
      ${input.personId}::uuid,
      ${input.journeyId}::uuid,
      ${input.journeyStepId},
      ${input.enrollmentId},
      ${input.action},
      ${input.channel ?? null},
      ${input.reason ?? null},
      ${sql.json((input.metadata ?? {}) as never)}
    )
  `;
}

export async function bumpJourneyMetricsDaily(journeyId: string, field: "sends" | "enrollments_new", delta = 1): Promise<void> {
  if (field === "sends") {
    await sql`
      insert into public.messaging_journey_metrics_daily (journey_id, metric_date, sends)
      values (${journeyId}::uuid, current_date, ${delta})
      on conflict (journey_id, metric_date) do update set
        sends = public.messaging_journey_metrics_daily.sends + ${delta}
    `;
  } else {
    await sql`
      insert into public.messaging_journey_metrics_daily (journey_id, metric_date, enrollments_new)
      values (${journeyId}::uuid, current_date, ${delta})
      on conflict (journey_id, metric_date) do update set
        enrollments_new = public.messaging_journey_metrics_daily.enrollments_new + ${delta}
    `;
  }
}

export async function bumpStepMetricsDaily(
  journeyId: string,
  stepId: number,
  field: "attempts" | "sent" | "blocked",
  delta = 1,
): Promise<void> {
  if (field === "attempts") {
    await sql`
      insert into public.messaging_journey_step_metrics_daily (journey_id, journey_step_id, metric_date, attempts)
      values (${journeyId}::uuid, ${stepId}, current_date, ${delta})
      on conflict (journey_id, journey_step_id, metric_date) do update set
        attempts = public.messaging_journey_step_metrics_daily.attempts + ${delta}
    `;
  } else if (field === "sent") {
    await sql`
      insert into public.messaging_journey_step_metrics_daily (journey_id, journey_step_id, metric_date, sent)
      values (${journeyId}::uuid, ${stepId}, current_date, ${delta})
      on conflict (journey_id, journey_step_id, metric_date) do update set
        sent = public.messaging_journey_step_metrics_daily.sent + ${delta}
    `;
  } else {
    await sql`
      insert into public.messaging_journey_step_metrics_daily (journey_id, journey_step_id, metric_date, blocked)
      values (${journeyId}::uuid, ${stepId}, current_date, ${delta})
      on conflict (journey_id, journey_step_id, metric_date) do update set
        blocked = public.messaging_journey_step_metrics_daily.blocked + ${delta}
    `;
  }
}

export async function recordPersonCommunicationHistory(input: {
  personId: string;
  journeyId?: string | null;
  journeyStepId?: number | null;
  channel: string;
  direction: "outbound" | "inbound";
  eventType: string;
  commsQueueId?: number | null;
  complianceMessageLogId?: number | null;
  templateKey?: string | null;
  engagement?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    insert into public.person_communication_history (
      person_id,
      journey_id,
      journey_step_id,
      channel,
      direction,
      event_type,
      comms_queue_id,
      compliance_message_log_id,
      template_key,
      engagement,
      metadata
    ) values (
      ${input.personId}::uuid,
      ${input.journeyId ?? null}::uuid,
      ${input.journeyStepId ?? null},
      ${input.channel},
      ${input.direction},
      ${input.eventType},
      ${input.commsQueueId ?? null},
      ${input.complianceMessageLogId ?? null},
      ${input.templateKey ?? null},
      ${sql.json((input.engagement ?? {}) as never)},
      ${sql.json((input.metadata ?? {}) as never)}
    )
  `;
}
