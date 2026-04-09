import sql from "@/lib/db";
import { deliverApprovedQueueItem } from "@/lib/comms/deliver-queue-item";
import type {
  CommsQueueRow,
  CommsTemplateRow,
} from "@/lib/types/contracts/comms";

export type SendCommsQueueItemResult = Awaited<ReturnType<typeof deliverApprovedQueueItem>>;

function previewBody(body: string, max = 500): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max)}…`;
}

function iso(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? new Date(0).toISOString() : x.toISOString();
}

export async function listCommsTemplates(activeOnly = true): Promise<CommsTemplateRow[]> {
  const rows = activeOnly
    ? await sql<
        Array<{
          id: string | number;
          template_key: string;
          name: string;
          channel: string;
          subject: string | null;
          body: string;
          is_active: boolean;
        }>
      >`
        select id, template_key, name, channel, subject, body, is_active
        from public.comms_templates
        where is_active = true
        order by name asc
      `
    : await sql<
        Array<{
          id: string | number;
          template_key: string;
          name: string;
          channel: string;
          subject: string | null;
          body: string;
          is_active: boolean;
        }>
      >`
        select id, template_key, name, channel, subject, body, is_active
        from public.comms_templates
        order by name asc
      `;
  return rows.map((r) => ({
    id: Number(r.id),
    templateKey: r.template_key,
    name: r.name,
    channel: r.channel === "sms" ? "sms" : "email",
    subject: r.subject,
    body: r.body,
    isActive: r.is_active,
  }));
}

export async function getTemplateByKey(templateKey: string): Promise<CommsTemplateRow | null> {
  const rows = await sql<
    Array<{
      id: string | number;
      template_key: string;
      name: string;
      channel: string;
      subject: string | null;
      body: string;
      is_active: boolean;
    }>
  >`
    select id, template_key, name, channel, subject, body, is_active
    from public.comms_templates
    where template_key = ${templateKey}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    templateKey: r.template_key,
    name: r.name,
    channel: r.channel === "sms" ? "sms" : "email",
    subject: r.subject,
    body: r.body,
    isActive: r.is_active,
  };
}

export async function listCommsQueue(limit = 50): Promise<CommsQueueRow[]> {
  const lim = Math.min(200, Math.max(1, limit));
  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      person_id: string;
      channel: string;
      template_key: string | null;
      subject: string | null;
      body: string;
      status: string;
      compliance_message_log_id: string | number | null;
      block_reason: string | null;
      messaging_journey_id: string | null;
      messaging_journey_step_id: string | number | null;
    }>
  >`
    select
      id,
      created_at,
      person_id,
      channel,
      template_key,
      subject,
      body,
      status,
      compliance_message_log_id,
      block_reason,
      messaging_journey_id,
      messaging_journey_step_id
    from public.comms_queue
    order by created_at desc
    limit ${lim}
  `;
  return rows.map(
    (r): CommsQueueRow => ({
      id: Number(r.id),
      createdAt: iso(r.created_at),
      personId: String(r.person_id),
      channel: r.channel === "sms" ? "sms" : "email",
      templateKey: r.template_key,
      subject: r.subject,
      body: r.body,
      status: r.status,
      complianceMessageLogId:
        r.compliance_message_log_id != null ? Number(r.compliance_message_log_id) : null,
      blockReason: r.block_reason,
      messagingJourneyId: r.messaging_journey_id,
      messagingJourneyStepId:
        r.messaging_journey_step_id != null ? Number(r.messaging_journey_step_id) : null,
    }),
  );
}

export async function createCommsQueueDraft(input: {
  personId: string;
  channel: "email" | "sms";
  templateKey?: string | null;
  subject?: string | null;
  body: string;
  createdBy?: string | null;
  messagingJourneyId?: string | null;
  messagingJourneyStepId?: number | null;
}): Promise<number> {
  const rows = await sql<Array<{ id: string | number }>>`
    insert into public.comms_queue (
      person_id,
      channel,
      template_key,
      subject,
      body,
      status,
      created_by,
      messaging_journey_id,
      messaging_journey_step_id
    ) values (
      ${input.personId}::uuid,
      ${input.channel},
      ${input.templateKey ?? null},
      ${input.subject ?? null},
      ${input.body},
      'draft',
      ${input.createdBy ?? null},
      ${input.messagingJourneyId ?? null}::uuid,
      ${input.messagingJourneyStepId ?? null}
    )
    returning id
  `;
  return Number(rows[0]?.id ?? 0);
}

export async function submitCommsQueue(id: number): Promise<boolean> {
  const rows = await sql<Array<{ id: string | number }>>`
    update public.comms_queue
    set
      status = 'pending_approval',
      submitted_at = now(),
      updated_at = now()
    where id = ${id}
      and status = 'draft'
    returning id
  `;
  return rows.length > 0;
}

export async function approveCommsQueue(id: number, approvedBy: string | null): Promise<boolean> {
  const rows = await sql<Array<{ id: string | number }>>`
    update public.comms_queue
    set
      status = 'approved',
      approved_by = ${approvedBy},
      approved_at = now(),
      updated_at = now()
    where id = ${id}
      and status = 'pending_approval'
    returning id
  `;
  return rows.length > 0;
}

export async function rejectCommsQueue(
  id: number,
  rejectedBy: string | null,
  reason: string,
): Promise<boolean> {
  const rows = await sql<Array<{ id: string | number }>>`
    update public.comms_queue
    set
      status = 'rejected',
      rejected_by = ${rejectedBy},
      rejected_at = now(),
      rejection_reason = ${reason},
      updated_at = now()
    where id = ${id}
      and status = 'pending_approval'
    returning id
  `;
  return rows.length > 0;
}

export async function getCommsQueueItem(id: number): Promise<CommsQueueRow | null> {
  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      person_id: string;
      channel: string;
      template_key: string | null;
      subject: string | null;
      body: string;
      status: string;
      compliance_message_log_id: string | number | null;
      block_reason: string | null;
      messaging_journey_id: string | null;
      messaging_journey_step_id: string | number | null;
    }>
  >`
    select
      id,
      created_at,
      person_id,
      channel,
      template_key,
      subject,
      body,
      status,
      compliance_message_log_id,
      block_reason,
      messaging_journey_id,
      messaging_journey_step_id
    from public.comms_queue
    where id = ${id}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    createdAt: iso(r.created_at),
    personId: String(r.person_id),
    channel: r.channel === "sms" ? "sms" : "email",
    templateKey: r.template_key,
    subject: r.subject,
    body: r.body,
    status: r.status,
    complianceMessageLogId:
      r.compliance_message_log_id != null ? Number(r.compliance_message_log_id) : null,
    blockReason: r.block_reason,
    messagingJourneyId: r.messaging_journey_id,
    messagingJourneyStepId:
      r.messaging_journey_step_id != null ? Number(r.messaging_journey_step_id) : null,
  };
}

export async function sendCommsQueueItem(queueId: number): Promise<SendCommsQueueItemResult> {
  return deliverApprovedQueueItem(queueId);
}

/** Merge simple {{first_name}} / {{display_name}} tokens from people row. */
export async function mergeTemplateForPerson(
  body: string,
  subject: string | null,
  personId: string,
): Promise<{ body: string; subject: string | null }> {
  const rows = await sql<Array<{ first_name: string | null; display_name: string | null }>>`
    select first_name, display_name from public.people where id = ${personId}::uuid limit 1
  `;
  const p = rows[0];
  const first = (p?.first_name ?? "").trim() || "Friend";
  const display = (p?.display_name ?? "").trim() || first;
  const rep = (t: string) =>
    t
      .replace(/\{\{first_name\}\}/g, first)
      .replace(/\{\{display_name\}\}/g, display)
      .replace(/\{\{event_title\}\}/g, "Event")
      .replace(/\{\{when\}\}/g, "TBD");
  let b = rep(body);
  let s = subject;
  if (s) {
    s = rep(s);
  }
  return { body: b, subject: s };
}
