import type { TurfRow, TurfListFilters } from "@/lib/types/field";

export type FieldMobileHomePayload = {
  sync: {
    status: "synced" | "pending" | "failed" | "offline";
    lastSyncAt: string | null;
    pendingCount: number | null;
  };
  today: {
    doorsAssigned: number | null;
    doorsCompleted: number | null;
    followupsCreated: number | null;
  };
  bestNextAction: string;
};

export type FieldMobileTurfListPayload = {
  filters: Required<Pick<TurfListFilters, "activeOnly" | "limit">> &
    Pick<TurfListFilters, "countyId" | "assignedToVolunteerId">;
  assigned: TurfRow[];
  available: TurfRow[];
  completed: TurfRow[];
};

