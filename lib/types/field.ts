export type TurfRow = {
  id: number;
  turfName: string;
  countyId: number | null;
  countyName: string | null;
  precinctLabel: string | null;
  doorCount: number | null;
  priorityScore: number | null;
  isActive: boolean;
};

export type TurfListFilters = {
  assignedToVolunteerId?: number;
  countyId?: number;
  activeOnly?: boolean;
  limit?: number;
};

