import sql from "@/lib/db";
import { canSendOutbound } from "@/lib/compliance/outreach-eligibility";
import { recordPersonCommunicationHistory } from "@/lib/queries/messaging-orchestration";
import {
  getSendGridApiKey,
  getSendGridFromEmail,
  getTwilioAccountSid,
  getTwilioAuthToken,
  getTwilioFromNumber,
  isCommsDryRun,
} from "@/lib/env";
import { sendSendGridEmail } from "@/lib/integrations/sendgrid-mail";
import { sendTwilioSms } from "@/lib/integrations/twilio-sms";
import { getPrimaryRecipient } from "@/lib/comms/resolve-recipient";
import type { CommsQueueRow } from "@/lib/types/contracts/comms";

function previewBody(body: string, max = 500): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max)}…`;
}

function providersConfiguredForChannel(channel: "email" | "sms"): boolean {
  if (channel === "email") {
    return Boolean(getSendGridApiKey() && getSendGridFromEmail());
  }
  return Boolean(getTwilioAccountSid() && getTwilioAuthToken() && getTwilioFromNumber());
}

function iso(d: Date | string): string {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? new Date(0).toISOString() : x.toISOString();
}

async function recordOutboundMemory(
  item: CommsQueueRow,
  queueId: number,
  complianceMessageLogId: number,
): Promise<void> {
  await recordPersonCommunicationHistory({
    personId: item.personId,
    journeyId: item.messagingJourneyId ?? null,
    journeyStepId: item.messagingJourneyStepId ?? null,
    channel: item.channel,
    direction: "outbound",
    eventType: "sent",
    commsQueueId: queueId,
    complianceMessageLogId,
    templateKey: item.templateKey,
    engagement: {},
    metadata: { source: "comms_queue" },
  });
}

async function loadQueueRow(queueId: number): Promise<CommsQueueRow | null> {
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
    where id = ${queueId}
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

/**
 * Compliance gate → queued log → provider send → update log + queue.
 */
export async function deliverApprovedQueueItem(queueId: number): Promise<
  | { ok: true; complianceMessageLogId: number; providerMessageId: string | null }
  | { ok: false; reason: "not_found" | "bad_status" | "blocked" | "config" | "send"; detail?: string }
> {
  const item = await loadQueueRow(queueId);
  if (!item) return { ok: false, reason: "not_found" };
  if (item.status !== "approved") {
    return { ok: false, reason: "bad_status" };
  }

  const gate = await canSendOutbound(item.personId, item.channel);
  if (!gate.ok) {
    await sql`
      update public.comms_queue
      set
        status = 'blocked_compliance',
        block_reason = ${gate.reason},
        updated_at = now()
      where id = ${queueId}
    `;
    return { ok: false, reason: "blocked", detail: gate.reason };
  }

  const toValue = await getPrimaryRecipient(item.personId, item.channel);
  if (!toValue) {
    const msg = `No ${item.channel} on file for this person.`;
    await sql`
      update public.comms_queue
      set
        status = 'failed',
        block_reason = ${msg},
        updated_at = now()
      where id = ${queueId}
    `;
    return { ok: false, reason: "send", detail: msg };
  }

  if (!isCommsDryRun() && !providersConfiguredForChannel(item.channel)) {
    const msg =
      item.channel === "email"
        ? "Configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL (or set COMMS_PROVIDER_DRY_RUN=true)."
        : "Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (or set COMMS_PROVIDER_DRY_RUN=true).";
    return { ok: false, reason: "config", detail: msg };
  }

  const logRows = await sql<Array<{ id: string | number }>>`
    insert into public.compliance_message_log (
      person_id,
      channel,
      to_value,
      template_key,
      subject,
      body_preview,
      status,
      provider,
      comms_queue_id
    ) values (
      ${item.personId}::uuid,
      ${item.channel},
      ${toValue},
      ${item.templateKey},
      ${item.subject},
      ${previewBody(item.body)},
      'queued',
      ${isCommsDryRun() ? "system" : null},
      ${queueId}
    )
    returning id
  `;
  const logId = Number(logRows[0]?.id ?? 0);
  if (!logId) {
    return { ok: false, reason: "send", detail: "Failed to create compliance log row." };
  }

  if (isCommsDryRun()) {
    await sql`
      update public.compliance_message_log
      set
        status = 'sent',
        sent_at = now(),
        provider = 'system',
        provider_message_id = ${"dry-run"},
        error = null
      where id = ${logId}
    `;
    await sql`
      update public.comms_queue
      set
        status = 'sent',
        compliance_message_log_id = ${logId},
        updated_at = now()
      where id = ${queueId}
    `;
    await recordOutboundMemory(item, queueId, logId);
    return { ok: true, complianceMessageLogId: logId, providerMessageId: "dry-run" };
  }

  try {
    let providerMessageId: string | null = null;
    if (item.channel === "email") {
      const subj = item.subject?.trim() || "(no subject)";
      const r = await sendSendGridEmail({
        to: toValue,
        subject: subj,
        text: item.body,
      });
      providerMessageId = r.providerMessageId;
    } else {
      const r = await sendTwilioSms({ to: toValue, body: item.body });
      providerMessageId = r.providerMessageId;
    }

    await sql`
      update public.compliance_message_log
      set
        status = 'sent',
        sent_at = now(),
        provider = ${item.channel === "email" ? "sendgrid" : "twilio"},
        provider_message_id = ${providerMessageId},
        error = null
      where id = ${logId}
    `;
    await sql`
      update public.comms_queue
      set
        status = 'sent',
        compliance_message_log_id = ${logId},
        updated_at = now()
      where id = ${queueId}
    `;
    await recordOutboundMemory(item, queueId, logId);
    return { ok: true, complianceMessageLogId: logId, providerMessageId };
  } catch (e) {
    const err = String(e);
    await sql`
      update public.compliance_message_log
      set
        status = 'failed',
        error = ${err.slice(0, 2000)}
      where id = ${logId}
    `;
    await sql`
      update public.comms_queue
      set
        status = 'failed',
        compliance_message_log_id = ${logId},
        block_reason = ${err.slice(0, 500)},
        updated_at = now()
      where id = ${queueId}
    `;
    return { ok: false, reason: "send", detail: err };
  }
}
