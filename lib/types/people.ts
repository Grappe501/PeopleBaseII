export type PersonStatus =
  | "active"
  | "inactive"
  | "archived"
  | "deceased"
  | "moved"
  | (string & {});

export type PersonRow = {
  id: string; // uuid
  createdAt: string;
  updatedAt: string;

  displayName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  preferredName: string | null;

  dateOfBirth: string | null;
  birthYear: number | null;

  gender: string | null;
  languagePreference: string | null;

  status: PersonStatus;
  sourceConfidenceScore: number | null;

  primaryCountyId: number | null;
  primaryPrecinctLabel: string | null;
  primaryCity: string | null;
  primaryState: string | null;
  primaryZip5: string | null;

  isVoter: boolean;
  isVolunteer: boolean;
  isDonor: boolean;
  isSupporter: boolean;
};

export type PeopleSearchRow = {
  personId: string;
  displayName: string;
  countyName: string | null;
  emailPrimary: string | null;
  phonePrimary: string | null;
  isVolunteer: boolean;
  isDonor: boolean;
  lastActivityAt: string | null;
};

export type PeopleSearchFilters = {
  q?: string;
  countyId?: number;
  limit?: number;
  volunteerOnly?: boolean;
  donorOnly?: boolean;
};

