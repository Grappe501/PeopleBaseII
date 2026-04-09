import sql from "@/lib/db";
import type {
  VolunteerDetailPagePayload,
  VolunteersDashboardPagePayload,
  VolunteersListPagePayload,
  VolunteerOsReadiness,
} from "@/lib/types/contracts/volunteers-pages";
import type { VolunteerRow, VolunteerListFilters, VolunteerStatus } from "@/lib/types/volunteers";

function readiness(): VolunteerOsReadiness {
  return {
    ready: true,
    missing: [
      // reserved for future expansions (kept for UI messaging)
    ],
  };
}

function iso(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : new Date(value ?? "");
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function asStatus(value: string | null | undefined): VolunteerStatus {
  if (value === "active" || value === "inactive") return value;
  return "new";
}

function mapVolunteerRow(r: {
  id: string | number;
  created_at: Date | string;
  updated_at: Date | string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  county_id: string | number | null;
  county_name: string | null;
  volunteer_status: string;
  onboarding_status: string;
  notes: string | null;
}): VolunteerRow {
  return {
    id: Number(r.id),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    countyId: r.county_id != null ? Number(r.county_id) : null,
    countyName: r.county_name,
    volunteerStatus: asStatus(r.volunteer_status),
    onboardingStatus:
      (r.onboarding_status as VolunteerRow["onboardingStatus"]) ?? "not_started",
    notes: r.notes,
  };
}

export async function getVolunteersDashboardPayload(): Promise<VolunteersDashboardPagePayload> {
  try {
    const counts = await sql<
      Array<{
        total: string | number;
        active: string | number;
        new_7d: string | number;
      }>
    >`
      select
        count(*)::bigint as total,
        count(*) filter (where volunteer_status = 'active')::bigint as active,
        count(*) filter (where created_at >= now() - interval '7 days')::bigint as new_7d
      from public.volunteers
    `;

    const c = counts[0] ?? { total: 0, active: 0, new_7d: 0 };

    return {
      readiness: readiness(),
      metrics: {
        totalVolunteers: Number(c.total ?? 0),
        activeVolunteers: Number(c.active ?? 0),
        newVolunteers7d: Number(c.new_7d ?? 0),
        activationRatePct: null,
        retention30dPct: null,
      },
      alerts: [],
    };
  } catch (e) {
    return {
      readiness: { ready: false, missing: ["public.volunteers (table)"] },
      metrics: {
        totalVolunteers: null,
        activeVolunteers: null,
        newVolunteers7d: null,
        activationRatePct: null,
        retention30dPct: null,
      },
      alerts: [{ id: "volunteers-db", message: String(e), severity: "error" }],
    };
  }
}

export async function listVolunteers(
  filters?: VolunteerListFilters,
): Promise<VolunteersListPagePayload> {
  const q = (filters?.q ?? "").trim();
  const limit = Number.isFinite(filters?.limit) ? Math.min(Math.max(filters!.limit!, 1), 200) : 50;
  const offset = Number.isFinite(filters?.offset) ? Math.max(filters!.offset!, 0) : 0;
  const countyId = filters?.countyId;
  const status = filters?.status;

  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      updated_at: Date | string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      county_id: string | number | null;
      county_name: string | null;
      volunteer_status: string;
      onboarding_status: string;
      notes: string | null;
    }>
  >`
    select
      v.id,
      v.created_at,
      v.updated_at,
      v.first_name,
      v.last_name,
      v.email,
      v.phone,
      v.county_id,
      gc.county_name,
      v.volunteer_status,
      v.onboarding_status,
      v.notes
    from public.volunteers v
    left join public.geo_counties gc
      on gc.id = v.county_id
    where (
      ${q} = ''
      or coalesce(v.first_name, '') ilike ${"%" + q + "%"}
      or coalesce(v.last_name, '') ilike ${"%" + q + "%"}
      or coalesce(v.email, '') ilike ${"%" + q + "%"}
      or coalesce(v.phone, '') ilike ${"%" + q + "%"}
    )
      and (${countyId ?? null} is null or v.county_id = ${countyId ?? null})
      and (${status ?? null} is null or v.volunteer_status = ${status ?? null})
    order by v.created_at desc, v.id desc
    limit ${limit}
    offset ${offset}
  `;

  return {
    readiness: readiness(),
    filters: { q, limit, offset, countyId, status },
    rows: rows.map(mapVolunteerRow),
  };
}

export async function getVolunteerDetailPayload(
  volunteerId: number,
): Promise<VolunteerDetailPagePayload> {
  const rows = await sql<
    Array<{
      id: string | number;
      created_at: Date | string;
      updated_at: Date | string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      county_id: string | number | null;
      county_name: string | null;
      volunteer_status: string;
      onboarding_status: string;
      notes: string | null;
    }>
  >`
    select
      v.id,
      v.created_at,
      v.updated_at,
      v.first_name,
      v.last_name,
      v.email,
      v.phone,
      v.county_id,
      gc.county_name,
      v.volunteer_status,
      v.onboarding_status,
      v.notes
    from public.volunteers v
    left join public.geo_counties gc
      on gc.id = v.county_id
    where v.id = ${volunteerId}
    limit 1
  `;

  return {
    readiness: readiness(),
    volunteer: rows[0] ? mapVolunteerRow(rows[0]) : null,
  };
}

