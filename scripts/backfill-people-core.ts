/**
 * Backfill the unified People tables from existing internal sources.
 *
 * Usage:
 *   npx tsx scripts/backfill-people-core.ts
 *
 * This script is conservative:
 * - Deterministic linking only via normalized email or normalized phone.
 * - Always preserves provenance with person_source_links.
 * - Does not modify source tables.
 */
import dotenv from "dotenv";
import path from "path";
import postgres from "postgres";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("Missing DATABASE_URL in .env.local");

const sql = postgres(databaseUrl, { ssl: "require", max: 1, connect_timeout: 60 });

function normalizeEmail(v: string | null): string | null {
  if (!v) return null;
  const x = v.trim().toLowerCase();
  return x.length ? x : null;
}

function normalizePhone(v: string | null): string | null {
  if (!v) return null;
  const digits = v.replace(/[^\d]/g, "");
  return digits.length ? digits : null;
}

async function findPersonIdByIdentifier(
  identifierType: "email" | "phone",
  normalized: string,
): Promise<string | null> {
  const rows = await sql<Array<{ person_id: string }>>`
    select person_id
    from public.person_identifiers
    where identifier_type = ${identifierType}
      and identifier_normalized = ${normalized}
    limit 1
  `;
  return rows[0]?.person_id ?? null;
}

async function createPerson(input: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryCountyId: number | null;
  primaryCity: string | null;
  primaryState: string | null;
  primaryZip5: string | null;
  isVolunteer?: boolean;
  isSupporter?: boolean;
}): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    insert into public.people (
      display_name,
      first_name,
      last_name,
      primary_county_id,
      primary_city,
      primary_state,
      primary_zip5,
      is_volunteer,
      is_supporter
    )
    values (
      ${input.displayName},
      ${input.firstName},
      ${input.lastName},
      ${input.primaryCountyId},
      ${input.primaryCity},
      ${input.primaryState},
      ${input.primaryZip5},
      ${input.isVolunteer ?? false},
      ${input.isSupporter ?? false}
    )
    returning id
  `;
  return rows[0]!.id;
}

async function linkIdentifier(input: {
  personId: string;
  identifierType: string;
  identifierValue: string;
  identifierNormalized: string | null;
  sourceSystem: string;
  isPrimary?: boolean;
  isVerified?: boolean;
}) {
  await sql`
    insert into public.person_identifiers (
      person_id,
      identifier_type,
      identifier_value,
      identifier_normalized,
      source_system,
      is_primary,
      is_verified
    )
    values (
      ${input.personId},
      ${input.identifierType},
      ${input.identifierValue},
      ${input.identifierNormalized},
      ${input.sourceSystem},
      ${input.isPrimary ?? false},
      ${input.isVerified ?? false}
    )
    on conflict (identifier_type, identifier_value) do update set
      person_id = excluded.person_id
  `;
}

async function upsertContactMethod(input: {
  personId: string;
  contactType: string;
  contactValue: string;
  contactNormalized: string | null;
  sourceSystem: string;
  isPrimary?: boolean;
}) {
  // There is no unique constraint; keep it simple: insert and rely on future de-dup tooling.
  await sql`
    insert into public.person_contact_methods (
      person_id,
      contact_type,
      contact_value,
      contact_normalized,
      is_primary,
      is_verified,
      can_email,
      can_text,
      can_call,
      consent_status,
      consent_source,
      consent_updated_at
    )
    values (
      ${input.personId},
      ${input.contactType},
      ${input.contactValue},
      ${input.contactNormalized},
      ${input.isPrimary ?? false},
      false,
      ${input.contactType === "email"},
      ${input.contactType === "mobile_phone"},
      ${input.contactType === "mobile_phone"},
      'unknown',
      ${input.sourceSystem},
      now()
    )
  `;
}

async function upsertSourceLink(input: {
  personId: string;
  sourceSystem: string;
  sourceTable: string;
  sourceRecordKey: string;
  matchType: string;
  matchScore: number | null;
  linkedBy: string;
}) {
  await sql`
    insert into public.person_source_links (
      person_id,
      source_system,
      source_table,
      source_record_key,
      match_type,
      match_score,
      linked_by
    )
    values (
      ${input.personId},
      ${input.sourceSystem},
      ${input.sourceTable},
      ${input.sourceRecordKey},
      ${input.matchType},
      ${input.matchScore},
      ${input.linkedBy}
    )
    on conflict (source_system, source_table, source_record_key) do update set
      person_id = excluded.person_id
  `;
}

async function backfillFromVolunteers() {
  const rows = await sql<
    Array<{
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      county_id: number | null;
    }>
  >`select id, first_name, last_name, email, phone, county_id from public.volunteers order by id asc`;

  for (const v of rows) {
    const emailNorm = normalizeEmail(v.email);
    const phoneNorm = normalizePhone(v.phone);

    let personId: string | null = null;
    if (emailNorm) personId = await findPersonIdByIdentifier("email", emailNorm);
    if (!personId && phoneNorm) personId = await findPersonIdByIdentifier("phone", phoneNorm);

    const displayName =
      [v.first_name?.trim(), v.last_name?.trim()].filter(Boolean).join(" ") || null;

    if (!personId) {
      personId = await createPerson({
        displayName,
        firstName: v.first_name?.trim() || null,
        lastName: v.last_name?.trim() || null,
        primaryCountyId: v.county_id ?? null,
        primaryCity: null,
        primaryState: "AR",
        primaryZip5: null,
        isVolunteer: true,
        isSupporter: true,
      });
    } else {
      await sql`
        update public.people
        set
          is_volunteer = true,
          is_supporter = true,
          primary_county_id = coalesce(primary_county_id, ${v.county_id}),
          updated_at = now()
        where id = ${personId}
      `;
    }

    await upsertSourceLink({
      personId,
      sourceSystem: "internal",
      sourceTable: "volunteers",
      sourceRecordKey: String(v.id),
      matchType: emailNorm || phoneNorm ? "deterministic" : "manual",
      matchScore: emailNorm || phoneNorm ? 99 : null,
      linkedBy: "system",
    });

    await linkIdentifier({
      personId,
      identifierType: "volunteer_id",
      identifierValue: String(v.id),
      identifierNormalized: String(v.id),
      sourceSystem: "internal",
      isPrimary: false,
      isVerified: true,
    });

    if (v.email && emailNorm) {
      await linkIdentifier({
        personId,
        identifierType: "email",
        identifierValue: v.email.trim(),
        identifierNormalized: emailNorm,
        sourceSystem: "internal",
        isPrimary: true,
        isVerified: false,
      });
      await upsertContactMethod({
        personId,
        contactType: "email",
        contactValue: v.email.trim(),
        contactNormalized: emailNorm,
        sourceSystem: "volunteers",
        isPrimary: true,
      });
    }

    if (v.phone && phoneNorm) {
      await linkIdentifier({
        personId,
        identifierType: "phone",
        identifierValue: v.phone.trim(),
        identifierNormalized: phoneNorm,
        sourceSystem: "internal",
        isPrimary: v.email ? false : true,
        isVerified: false,
      });
      await upsertContactMethod({
        personId,
        contactType: "mobile_phone",
        contactValue: v.phone.trim(),
        contactNormalized: phoneNorm,
        sourceSystem: "volunteers",
        isPrimary: !v.email,
      });
    }
  }
}

async function backfillFromCanvassContacts() {
  const rows = await sql<
    Array<{
      id: number;
      full_name: string | null;
      phone: string | null;
      email: string | null;
      county_id: number | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      address1: string;
      address2: string | null;
    }>
  >`
    select id, full_name, phone, email, county_id, city, state, zip, address1, address2
    from public.canvass_contacts
    order by id asc
  `;

  for (const c of rows) {
    const emailNorm = normalizeEmail(c.email);
    const phoneNorm = normalizePhone(c.phone);

    let personId: string | null = null;
    if (emailNorm) personId = await findPersonIdByIdentifier("email", emailNorm);
    if (!personId && phoneNorm) personId = await findPersonIdByIdentifier("phone", phoneNorm);

    const displayName = c.full_name?.trim() || null;

    if (!personId) {
      personId = await createPerson({
        displayName,
        firstName: null,
        lastName: null,
        primaryCountyId: c.county_id ?? null,
        primaryCity: c.city?.trim() || null,
        primaryState: (c.state?.trim() || "AR").slice(0, 2),
        primaryZip5: c.zip?.trim()?.slice(0, 5) || null,
        isVolunteer: false,
        isSupporter: true,
      });
    } else {
      await sql`
        update public.people
        set
          is_supporter = true,
          primary_county_id = coalesce(primary_county_id, ${c.county_id}),
          primary_city = coalesce(primary_city, ${c.city}),
          primary_state = coalesce(primary_state, ${c.state}),
          primary_zip5 = coalesce(primary_zip5, ${c.zip}),
          updated_at = now()
        where id = ${personId}
      `;
    }

    await upsertSourceLink({
      personId,
      sourceSystem: "internal",
      sourceTable: "canvass_contacts",
      sourceRecordKey: String(c.id),
      matchType: emailNorm || phoneNorm ? "deterministic" : "probable",
      matchScore: emailNorm || phoneNorm ? 98 : 60,
      linkedBy: "system",
    });

    if (c.email && emailNorm) {
      await linkIdentifier({
        personId,
        identifierType: "email",
        identifierValue: c.email.trim(),
        identifierNormalized: emailNorm,
        sourceSystem: "field",
        isPrimary: true,
        isVerified: false,
      });
      await upsertContactMethod({
        personId,
        contactType: "email",
        contactValue: c.email.trim(),
        contactNormalized: emailNorm,
        sourceSystem: "canvass_contacts",
        isPrimary: true,
      });
    }

    if (c.phone && phoneNorm) {
      await linkIdentifier({
        personId,
        identifierType: "phone",
        identifierValue: c.phone.trim(),
        identifierNormalized: phoneNorm,
        sourceSystem: "field",
        isPrimary: c.email ? false : true,
        isVerified: false,
      });
      await upsertContactMethod({
        personId,
        contactType: "mobile_phone",
        contactValue: c.phone.trim(),
        contactNormalized: phoneNorm,
        sourceSystem: "canvass_contacts",
        isPrimary: !c.email,
      });
    }

    // Address capture (no uniqueness guarantees; future de-dupe tooling can compress).
    await sql`
      insert into public.person_addresses (
        person_id,
        address_type,
        house_number,
        street_name,
        unit,
        city,
        state,
        zip5,
        county_id,
        is_primary,
        is_current,
        source_system
      )
      values (
        ${personId},
        'home',
        null,
        ${c.address1 + (c.address2 ? " " + c.address2 : "")},
        null,
        ${c.city},
        ${c.state},
        ${c.zip ? c.zip.slice(0, 5) : null},
        ${c.county_id},
        true,
        true,
        'canvass_contacts'
      )
    `;
  }
}

async function main() {
  await backfillFromVolunteers();
  await backfillFromCanvassContacts();
  await sql.end({ timeout: 10 });
}

main().catch(async (err) => {
  console.error(err);
  await sql.end({ timeout: 10 });
  process.exit(1);
});

