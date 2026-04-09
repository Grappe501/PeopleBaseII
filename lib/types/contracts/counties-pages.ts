import type {
  CountyCityRow,
  CountyDetailRow,
  CountyPrecinctRow,
  StatewideCountyRow,
} from "@/lib/types/county-pages";

export type CountiesListFilters = {
  q?: string;
  limit?: number;
};

export type CountiesListPagePayload = {
  filters: Required<Pick<CountiesListFilters, "q" | "limit">>;
  rows: StatewideCountyRow[];
};

export type CountyDetailPagePayload = {
  county: CountyDetailRow;
  cities: CountyCityRow[];
  precincts: CountyPrecinctRow[];
};

