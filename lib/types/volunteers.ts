export type VolunteerStatus = "new" | "active" | "inactive";

export type OnboardingStatus =
  | "not_started"
  | "started"
  | "role_matched"
  | "first_action_assigned"
  | "activated";

export type VolunteerRow = {
  id: number;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  countyId: number | null;
  countyName: string | null;
  volunteerStatus: VolunteerStatus;
  onboardingStatus: OnboardingStatus;
  notes: string | null;
};

export type VolunteerListFilters = {
  q?: string;
  countyId?: number;
  status?: VolunteerStatus;
  limit?: number;
  offset?: number;
};

