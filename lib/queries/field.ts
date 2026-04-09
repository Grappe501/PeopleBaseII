import sql from "@/lib/db";
import type { TurfListFilters, TurfRow } from "@/lib/types/field";
import type { FieldMobileHomePayload, FieldMobileTurfListPayload } from "@/lib/types/contracts/field-mobile";

export async function getFieldMobileHomePayload(): Promise<FieldMobileHomePayload> {
  // Minimal placeholder until sessions/responses are wired into UI.
  return {
    sync: { status: "synced", lastSyncAt: null, pendingCount: null },
    today: { doorsAssigned: null, doorsCompleted: null, followupsCreated: null },
    bestNextAction:
      "Tap outcomes first. Keep notes short. If signal drops, keep moving — sync later.",
  };
}

function mapTurf(r: {
  id: string | number;
  turf_name: string;
  county_id: string | number | null;
  county_name: string | null;
  precinct_label: string | null;
  door_count: number | null;
  priority_score: string | number | null;
  is_active: boolean;
}): TurfRow {
  return {
    id: Number(r.id),
    turfName: r.turf_name,
    countyId: r.county_id != null ? Number(r.county_id) : null,
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    doorCount: r.door_count,
    priorityScore: r.priority_score != null ? Number(r.priority_score) : null,
    isActive: r.is_active,
  };
}

export async function listTurfs(filters?: TurfListFilters): Promise<TurfRow[]> {
  const limit = Number.isFinite(filters?.limit) ? Math.min(Math.max(filters!.limit!, 1), 200) : 50;
  const countyId = filters?.countyId ?? null;
  const activeOnly = filters?.activeOnly ?? true;

  const rows = await sql<
    Array<{
      id: string | number;
      turf_name: string;
      county_id: string | number | null;
      county_name: string | null;
      precinct_label: string | null;
      door_count: number | null;
      priority_score: string | number | null;
      is_active: boolean;
    }>
  >`
    select
      t.id,
      t.turf_name,
      t.county_id,
      gc.county_name,
      t.precinct_label,
      t.door_count,
      t.priority_score,
      t.is_active
    from public.turfs t
    left join public.geo_counties gc on gc.id = t.county_id
    where (${countyId} is null or t.county_id = ${countyId})
      and (${activeOnly} = false or t.is_active = true)
    order by t.priority_score desc nulls last, t.door_count desc nulls last, t.turf_name asc
    limit ${limit}
  `;

  return rows.map(mapTurf);
}

export async function getFieldMobileTurfListPayload(
  filters?: TurfListFilters,
): Promise<FieldMobileTurfListPayload> {
  const activeOnly = filters?.activeOnly ?? true;
  const limit = Number.isFinite(filters?.limit) ? Math.min(Math.max(filters!.limit!, 1), 200) : 50;
  const countyId = filters?.countyId;
  const assignedToVolunteerId = filters?.assignedToVolunteerId;

  const assigned =
    assignedToVolunteerId != null
      ? await sql<
          Array<{
            id: string | number;
            turf_name: string;
            county_id: string | number | null;
            county_name: string | null;
            precinct_label: string | null;
            door_count: number | null;
            priority_score: string | number | null;
            is_active: boolean;
          }>
        >`
          select
            t.id,
            t.turf_name,
            t.county_id,
            gc.county_name,
            t.precinct_label,
            t.door_count,
            t.priority_score,
            t.is_active
          from public.turf_assignments a
          join public.turfs t on t.id = a.turf_id
          left join public.geo_counties gc on gc.id = t.county_id
          where a.volunteer_id = ${assignedToVolunteerId}
            and (${countyId ?? null} is null or t.county_id = ${countyId ?? null})
            and (${activeOnly} = false or t.is_active = true)
            and a.assignment_status in ('assigned', 'in_progress')
          order by t.priority_score desc nulls last, t.door_count desc nulls last, t.turf_name asc
          limit ${limit}
        `
      : [];

  // Available = active turfs not assigned to this volunteer (for now).
  const availableAll = await listTurfs({ countyId, activeOnly, limit });
  const assignedIds = new Set(assigned.map((r) => Number(r.id)));
  const available = availableAll.filter((t) => !assignedIds.has(t.id));

  return {
    filters: { activeOnly, limit, countyId, assignedToVolunteerId },
    assigned: assigned.map(mapTurf),
    available,
    completed: [],
  };
}

