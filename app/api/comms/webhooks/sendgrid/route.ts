import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingEngagementEventType } from "@/lib/messaging/branch-condition";
import { ingestEngagementFromComplianceLog } from "@/lib/messaging/engagement-ingestion";
import sql from "@/lib/db";
import { findComplianceLogIdsByProviderMessage } from "@/lib/queries/messaging-engagement";

export const dynamic = "force-dynamic";

type SendGridEvent = {
  event?: string;
  sg_message_id?: string;
  timestamp?: number;
  email?: string;
  reason?: string;
};

function normalizeSgId(id: string): string {
  return id.replace(/^</, "").replace(/>$/, "").trim();
}

/**
 * SendGrid Event Webhook — stores payload, updates `compliance_message_log`, records engagement events,
 * and resolves journey branches when configured.
 */
export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: number; updated: number; ingested: number }>>> {
  try {
    const payload = (await req.json().catch(() => [])) as unknown;
    const rows = await sql<Array<{ id: string | number }>>`
      insert into public.comms_webhook_events (provider, event_type, payload)
      values ('sendgrid', 'events', ${JSON.stringify(payload)}::jsonb)
      returning id
    `;
    const inboxId = Number(rows[0]?.id ?? 0);

    const events = Array.isArray(payload) ? payload : [];
    let updated = 0;
    let ingested = 0;

    for (const raw of events) {
      const ev = raw as SendGridEvent;
      const mid = ev.sg_message_id ? normalizeSgId(ev.sg_message_id) : "";
      if (!mid) continue;

      const evt = (ev.event ?? "").toLowerCase();
      const logIds = await findComplianceLogIdsByProviderMessage({
        provider: "sendgrid",
        providerMessageId: mid,
      });

      if (logIds.length === 0) continue;

      if (evt === "delivered") {
        for (const logId of logIds) {
          const u = await sql`
            update public.compliance_message_log
            set
              status = 'delivered',
              delivered_at = coalesce(delivered_at, now())
            where id = ${logId}
              and provider = 'sendgrid'
            returning id
          `;
          updated += u.length;
          await ingestEngagementFromComplianceLog({
            logId,
            eventType: "email_delivered",
            channel: "email",
            payload: { event: ev },
          });
          ingested += 1;
        }
      } else if (evt === "bounce" || evt === "dropped" || evt === "spamreport") {
        const errLine = `webhook:${evt}:${ev.reason ?? ""}`.slice(0, 2000);
        for (const logId of logIds) {
          const u = await sql`
            update public.compliance_message_log
            set
              status = 'failed',
              error = ${errLine}
            where id = ${logId}
              and provider = 'sendgrid'
            returning id
          `;
          updated += u.length;
          const engType: MessagingEngagementEventType = evt === "spamreport" ? "complaint" : "bounce";
          await ingestEngagementFromComplianceLog({
            logId,
            eventType: engType,
            channel: "email",
            payload: { event: ev },
          });
          ingested += 1;
        }
      } else if (evt === "open") {
        for (const logId of logIds) {
          await ingestEngagementFromComplianceLog({
            logId,
            eventType: "email_open",
            channel: "email",
            payload: { event: ev },
          });
          ingested += 1;
        }
      } else if (evt === "click") {
        for (const logId of logIds) {
          await ingestEngagementFromComplianceLog({
            logId,
            eventType: "email_click",
            channel: "email",
            payload: { event: ev },
          });
          ingested += 1;
        }
      }
    }

    return NextResponse.json({ success: true, data: { id: inboxId, updated, ingested } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
