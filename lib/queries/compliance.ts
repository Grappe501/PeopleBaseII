import sql from "@/lib/db";
import type { PersonChannelCompliance } from "@/lib/types/compliance";

export async function getPersonCompliance(personId: string): Promise<PersonChannelCompliance[]> {
  const rows = await sql<
    Array<{
      person_id: string;
      channel: "email" | "sms" | "phone" | "mail";
      consent_status: "granted" | "denied" | "unknown";
      suppression_reason: string | null;
      is_suppressed: boolean;
    }>
  >`
    select
      person_id::text as person_id,
      channel,
      consent_status,
      suppression_reason,
      is_suppressed
    from public.compliance_person_channel_status_v
    where person_id = ${personId}::uuid
    order by
      case channel
        when 'email' then 1
        when 'sms' then 2
        when 'phone' then 3
        when 'mail' then 4
        else 99
      end asc
  `;

  return rows.map((r) => ({
    personId: r.person_id,
    channel: r.channel,
    consentStatus: r.consent_status,
    suppressionReason: r.suppression_reason,
    isSuppressed: Boolean(r.is_suppressed),
  }));
}

