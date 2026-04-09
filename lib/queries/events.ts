import sql from "@/lib/db";
import type { CalendarEventRow, CalendarLevel } from "@/lib/types/events";

export async function listUpcomingEvents(options: {
  level: CalendarLevel;
  countyId?: number | null;
  geoCityId?: number | null;
  precinctLabel?: string | null;
  limit?: number;
}): Promise<CalendarEventRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 15, 1), 100);

  const level = options.level;
  const countyId = options.countyId ?? null;
  const geoCityId = options.geoCityId ?? null;
  const precinctLabel = options.precinctLabel ?? null;

  const rows = await sql<
    Array<{
      event_id: string | number;
      calendar_level: string;
      calendar_county_id: string | number | null;
      calendar_geo_city_id: string | number | null;
      calendar_precinct_label: string | null;
      title: string;
      description: string | null;
      starts_at: string;
      ends_at: string | null;
      timezone: string | null;
      location_name: string | null;
      location_address: string | null;
    }>
  >`
    select
      event_id,
      calendar_level,
      calendar_county_id,
      calendar_geo_city_id,
      calendar_precinct_label,
      title,
      description,
      starts_at::text as starts_at,
      ends_at::text as ends_at,
      timezone,
      location_name,
      location_address
    from public.events_rollup_v
    where calendar_level = ${level}
      and (
        ${level} = 'statewide'
        or (${level} = 'county' and calendar_county_id = ${countyId})
        or (${level} = 'place' and calendar_geo_city_id = ${geoCityId})
        or (${level} = 'precinct' and calendar_county_id = ${countyId} and calendar_precinct_label = ${precinctLabel})
      )
      and starts_at >= now() - interval '6 hours'
    order by starts_at asc
    limit ${limit}
  `;

  return rows.map((r) => ({
    eventId: Number(r.event_id),
    calendarLevel: r.calendar_level as CalendarLevel,
    calendarCountyId: r.calendar_county_id != null ? Number(r.calendar_county_id) : null,
    calendarGeoCityId: r.calendar_geo_city_id != null ? Number(r.calendar_geo_city_id) : null,
    calendarPrecinctLabel: r.calendar_precinct_label,
    title: r.title,
    description: r.description,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    timezone: r.timezone,
    locationName: r.location_name,
    locationAddress: r.location_address,
  }));
}

