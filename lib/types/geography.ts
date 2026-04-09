export type CountyReference = {
  id: number;
  stateFips: string;
  countyFips: string;
  countyName: string;
  countyKey: string;
};

export type PrecinctReference = {
  id: number;
  countyId: number;
  precinctKey: string;
  canonicalPrecinctCode: string | null;
  canonicalPrecinctName: string | null;
  status: string;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
};

export type PrecinctAlias = {
  id: number;
  precinctId: number;
  countyId: number;
  sourceSystem: string;
  sourceYear: number | null;
  sourcePrecinctCode: string | null;
  sourcePrecinctName: string | null;
  normalizedSourceKey: string | null;
  createdAt: string;
};

export type GeographyStatus = {
  countyCount: number;
  precinctCount: number;
  aliasCount: number;
  crosswalkPendingSuggestions: number;
  crosswalkExceptions: number;
};
