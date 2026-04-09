import sql from "@/lib/db";

/**
 * Primary destination for outbound comms from person_contact_methods.
 */
export async function getPrimaryRecipient(
  personId: string,
  channel: "email" | "sms",
): Promise<string | null> {
  if (channel === "email") {
    const rows = await sql<Array<{ contact_value: string }>>`
      select contact_value
      from public.person_contact_methods
      where person_id = ${personId}::uuid
        and contact_type = 'email'
      order by is_primary desc, is_verified desc, updated_at desc
      limit 1
    `;
    const v = rows[0]?.contact_value?.trim();
    return v || null;
  }

  const rows = await sql<Array<{ contact_value: string }>>`
    select contact_value
    from public.person_contact_methods
    where person_id = ${personId}::uuid
      and contact_type in ('mobile_phone', 'home_phone', 'work_phone', 'phone', 'sms')
    order by is_primary desc, is_verified desc, updated_at desc
    limit 1
  `;
  const v = rows[0]?.contact_value?.trim();
  return v || null;
}
