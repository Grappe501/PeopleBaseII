import sql from "@/lib/db";
import type { PeopleSearchFilters, PeopleSearchRow, PersonRow } from "@/lib/types/people";

function mapPersonRow(r: any): PersonRow {
  return {
    id: String(r.id),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),

    displayName: r.display_name ?? null,
    firstName: r.first_name ?? null,
    middleName: r.middle_name ?? null,
    lastName: r.last_name ?? null,
    suffix: r.suffix ?? null,
    preferredName: r.preferred_name ?? null,

    dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth).toISOString().slice(0, 10) : null,
    birthYear: r.birth_year ?? null,

    gender: r.gender ?? null,
    languagePreference: r.language_preference ?? null,

    status: r.status,
    sourceConfidenceScore: r.source_confidence_score ?? null,

    primaryCountyId: r.primary_county_id ?? null,
    primaryPrecinctLabel: r.primary_precinct_label ?? null,
    primaryCity: r.primary_city ?? null,
    primaryState: r.primary_state ?? null,
    primaryZip5: r.primary_zip5 ?? null,

    isVoter: Boolean(r.is_voter),
    isVolunteer: Boolean(r.is_volunteer),
    isDonor: Boolean(r.is_donor),
    isSupporter: Boolean(r.is_supporter),
  };
}

export async function getPersonById(personId: string): Promise<PersonRow | null> {
  const rows = await sql`
    select *
    from public.people
    where id = ${personId}::uuid
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  return mapPersonRow(r);
}

export async function searchPeople(filters: PeopleSearchFilters): Promise<PeopleSearchRow[]> {
  const limit = Math.max(1, Math.min(50, filters.limit ?? 20));
  const q = (filters.q ?? "").trim();
  const countyId = filters.countyId ?? null;

  const volunteerOnly = Boolean(filters.volunteerOnly);
  const donorOnly = Boolean(filters.donorOnly);

  const rows = await sql<PeopleSearchRow[]>`
    select
      person_id as "personId",
      display_name as "displayName",
      county_name as "countyName",
      email_primary as "emailPrimary",
      phone_primary as "phonePrimary",
      is_volunteer as "isVolunteer",
      is_donor as "isDonor",
      last_activity_at as "lastActivityAt"
    from public.people_master_v
    where
      (${q} = '' or display_name ilike ('%' || ${q} || '%') or email_primary ilike ('%' || ${q} || '%') or phone_primary ilike ('%' || ${q} || '%'))
      and (${countyId}::bigint is null or primary_county_id = ${countyId}::bigint)
      and (${volunteerOnly} = false or is_volunteer = true)
      and (${donorOnly} = false or is_donor = true)
    order by
      case when ${q} = '' then 1 else 0 end asc,
      last_activity_at desc nulls last,
      display_name asc
    limit ${limit}
  `;

  return rows.map((r) => ({
    ...r,
    displayName: r.displayName || "(unknown)",
  }));
}

