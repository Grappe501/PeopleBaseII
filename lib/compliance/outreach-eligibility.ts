import sql from "@/lib/db";

export type OutreachChannel = "email" | "sms";

/**
 * Blocks send if channel is suppressed or consent explicitly denied.
 * Unknown consent is allowed (ops can tighten policy later).
 */
export async function canSendOutbound(
  personId: string,
  channel: OutreachChannel,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rows = await sql<
    Array<{
      consent_status: string;
      is_suppressed: boolean;
      suppression_reason: string | null;
    }>
  >`
    select consent_status, is_suppressed, suppression_reason
    from public.compliance_person_channel_status_v
    where person_id = ${personId}::uuid
      and channel = ${channel}
    limit 1
  `;
  const r = rows[0];
  if (!r) {
    return { ok: false, reason: "Person or channel row not found." };
  }
  if (r.is_suppressed) {
    return {
      ok: false,
      reason: `Suppressed${r.suppression_reason ? `: ${r.suppression_reason}` : ""}`,
    };
  }
  if (r.consent_status === "denied") {
    return { ok: false, reason: "Consent denied for this channel." };
  }
  return { ok: true };
}
