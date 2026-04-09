import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { ingestEngagementFromComplianceLog } from "@/lib/messaging/engagement-ingestion";
import sql from "@/lib/db";
import { findComplianceLogIdsByProviderMessage } from "@/lib/queries/messaging-engagement";

export const dynamic = "force-dynamic";

function parseTwilioBody(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(text);
  for (const [k, v] of sp.entries()) {
    out[k] = v;
  }
  return out;
}

/**
 * Twilio status callback — form POST; updates `compliance_message_log` by `MessageSid`,
 * records `sms_delivered` / failures for orchestration branching.
 */
export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: number; updated: boolean; ingested: number }>>> {
  try {
    const ct = req.headers.get("content-type") ?? "";
    let flat: Record<string, string> = {};

    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      flat = parseTwilioBody(text);
    } else if (ct.includes("application/json")) {
      const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) {
        flat[k] = String(v ?? "");
      }
    } else {
      const text = await req.text();
      flat = parseTwilioBody(text);
    }

    const rows = await sql<Array<{ id: string | number }>>`
      insert into public.comms_webhook_events (provider, event_type, payload)
      values (
        'twilio',
        ${flat.MessageStatus ?? flat.SmsStatus ?? "status"},
        ${JSON.stringify(flat)}::jsonb
      )
      returning id
    `;
    const inboxId = Number(rows[0]?.id ?? 0);

    const sid = flat.MessageSid ?? flat.SmsSid ?? "";
    const st = (flat.MessageStatus ?? flat.SmsStatus ?? "").toLowerCase();

    let updated = false;
    let ingested = 0;
    if (sid) {
      const logIds = await findComplianceLogIdsByProviderMessage({
        provider: "twilio",
        providerMessageId: sid,
      });

      if (st === "delivered") {
        for (const logId of logIds) {
          const u = await sql`
            update public.compliance_message_log
            set
              status = 'delivered',
              delivered_at = coalesce(delivered_at, now())
            where id = ${logId}
              and provider = 'twilio'
            returning id
          `;
          updated = updated || u.length > 0;
          await ingestEngagementFromComplianceLog({
            logId,
            eventType: "sms_delivered",
            channel: "sms",
            payload: flat,
          });
          ingested += 1;
        }
      } else if (st === "failed" || st === "undelivered" || st === "canceled") {
        const errLine = `webhook:${st}:${flat.ErrorCode ?? ""}`.slice(0, 2000);
        for (const logId of logIds) {
          const u = await sql`
            update public.compliance_message_log
            set
              status = 'failed',
              error = ${errLine}
            where id = ${logId}
              and provider = 'twilio'
            returning id
          `;
          updated = updated || u.length > 0;
          await ingestEngagementFromComplianceLog({
            logId,
            eventType: "bounce",
            channel: "sms",
            payload: flat,
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
