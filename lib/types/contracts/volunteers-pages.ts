/**
 * Volunteer OS contracts.
 *
 * Note: As of now, volunteer-first tables are not yet implemented in the database.
 * These payloads are designed to be returned by API routes in a null-safe way while
 * backend tables/migrations are built.
 */
import type { VolunteerRow, VolunteerListFilters } from "@/lib/types/volunteers";

export type VolunteerOsReadiness = {
  ready: boolean;
  missing: string[];
};

export type VolunteersDashboardPagePayload = {
  readiness: VolunteerOsReadiness;
  metrics: {
    totalVolunteers: number | null;
    activeVolunteers: number | null;
    newVolunteers7d: number | null;
    activationRatePct: number | null;
    retention30dPct: number | null;
  };
  alerts: Array<{ id: string; message: string; severity: "info" | "warn" | "error" }>;
};

export type VolunteerDetailPagePayload = {
  readiness: VolunteerOsReadiness;
  volunteer: VolunteerRow | null;
};

export type VolunteersListPagePayload = {
  readiness: VolunteerOsReadiness;
  filters: Required<Pick<VolunteerListFilters, "q" | "limit" | "offset">> &
    Pick<VolunteerListFilters, "countyId" | "status">;
  rows: VolunteerRow[];
};

