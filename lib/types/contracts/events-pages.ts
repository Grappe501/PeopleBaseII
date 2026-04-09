import type { CalendarEventRow, CalendarLevel } from "@/lib/types/events";

export type EventsDashboardFilters = {
  level: CalendarLevel;
  countyId?: number;
  geoCityId?: number;
  precinctLabel?: string;
  limit?: number;
};

export type EventsDashboardPagePayload = {
  filters: EventsDashboardFilters;
  upcoming: CalendarEventRow[];
};

