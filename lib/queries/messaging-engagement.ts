import sql from "@/lib/db";
import type { MessagingEngagementEventType } from "@/lib/messaging/branch-condition";

export async function insertMessagingEngagementEvent(input: {
  personId: string;
  journeyId?: string | null;
  enrollmentId?: number | null;
  journeyStepId?: number | null;
  complianceMessageLogId?: number | null;
  commsQueueId?: number | null;
  channel: "email" | "sms" | "system";
  eventType: MessagingEngagementEventType | string;
  source?: string;
  externalId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<number | null> {
  const rows = await sql<Array<{ id: string | number }>>`
    insert into public.messaging_engagement_events (
      person_id,
      journey_id,
      enrollment_id,
      journey_step_id,
      compliance_message_log_id,
      comms_queue_id,
      channel,
      event_type,
      source,
      external_id,
      payload
    ) values (
      ${input.personId}::uuid,
      ${input.journeyId ?? null}::uuid,
      ${input.enrollmentId ?? null},
      ${input.journeyStepId ?? null},
      ${input.complianceMessageLogId ?? null},
      ${input.commsQueueId ?? null},
      ${input.channel},
      ${input.eventType},
      ${input.source ?? "webhook"},
      ${input.externalId ?? null},
      ${sql.json((input.payload ?? {}) as never)}
    )
    returning id
  `;
  return rows[0] != null ? Number(rows[0].id) : null;
}

export async function getComplianceLogById(logId: number): Promise<{
  id: number;
  personId: string | null;
  channel: string;
  providerMessageId: string | null;
} | null> {
  const rows = await sql<
    Array<{
      id: string | number;
      person_id: string | null;
      channel: string;
      provider_message_id: string | null;
    }>
  >`
    select id, person_id::text as person_id, channel, provider_message_id
    from public.compliance_message_log
    where id = ${logId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    personId: r.person_id,
    channel: r.channel,
    providerMessageId: r.provider_message_id,
  };
}

export async function findComplianceLogIdsByProviderMessage(params: {
  provider: "sendgrid" | "twilio";
  providerMessageId: string;
}): Promise<number[]> {
  const mid = params.providerMessageId;
  const rows = await sql<Array<{ id: string | number }>>`
    select id
    from public.compliance_message_log
    where provider = ${params.provider}
      and (
        provider_message_id = ${mid}
        or provider_message_id = ${`<${mid}>`}
        or replace(replace(provider_message_id, '<', ''), '>', '') = ${mid}
      )
  `;
  return rows.map((r) => Number(r.id));
}

export async function getJourneyContextFromComplianceLog(logId: number): Promise<{
  personId: string;
  journeyId: string | null;
  queueId: number | null;
  stepId: number | null;
} | null> {
  const rows = await sql<
    Array<{
      person_id: string | null;
      messaging_journey_id: string | null;
      comms_queue_id: string | number | null;
      messaging_journey_step_id: string | number | null;
    }>
  >`
    select
      l.person_id::text as person_id,
      q.messaging_journey_id,
      l.comms_queue_id,
      q.messaging_journey_step_id
    from public.compliance_message_log l
    left join public.comms_queue q on q.id = l.comms_queue_id
    where l.id = ${logId}
    limit 1
  `;
  const r = rows[0];
  if (!r?.person_id) return null;
  return {
    personId: r.person_id,
    journeyId: r.messaging_journey_id,
    queueId: r.comms_queue_id != null ? Number(r.comms_queue_id) : null,
    stepId: r.messaging_journey_step_id != null ? Number(r.messaging_journey_step_id) : null,
  };
}

export async function listWaitingBranchEnrollmentsForPerson(
  personId: string,
): Promise<
  Array<{
    id: number;
    journeyId: string;
    metadata: Record<string, unknown>;
  }>
> {
  const rows = await sql<
    Array<{
      id: string | number;
      journey_id: string;
      metadata: unknown;
    }>
  >`
    select id, journey_id, metadata
    from public.messaging_journey_enrollments
    where person_id = ${personId}::uuid
      and status = 'waiting_branch'
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    journeyId: r.journey_id,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  }));
}
