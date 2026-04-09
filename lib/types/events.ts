export type CalendarLevel = "statewide" | "county" | "place" | "precinct";

export type CalendarEventRow = {
  eventId: number;
  calendarLevel: CalendarLevel;
  calendarCountyId: number | null;
  calendarGeoCityId: number | null;
  calendarPrecinctLabel: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  locationName: string | null;
  locationAddress: string | null;
};

