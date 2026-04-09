import sql from "@/lib/db";
import type {
  CountyReference,
  GeographyStatus,
  PrecinctAlias,
  PrecinctReference,
} from "@/lib/types/geography";

function mapCounty(row: {
  id: string | number;
  state_fips: string;
  county_fips: string;
  county_name: string;
  county_key: string;
}): CountyReference {
  return {
    id: Number(row.id),
    stateFips: row.state_fips,
    countyFips: row.county_fips,
    countyName: row.county_name,
    countyKey: row.county_key,
  };
}

export async function getCountyReferences(): Promise<CountyReference[]> {
  try {
    const rows = await sql<{
      id: string | number;
      state_fips: string;
      county_fips: string;
      county_name: string;
      county_key: string;
    }[]>`
      select id, state_fips, county_fips, county_name, county_key
      from geo_counties
      order by county_key asc
    `;
    return rows.map(mapCounty);
  } catch {
    return [];
  }
}

export async function getPrecinctReferencesByCounty(
  countyId: number,
): Promise<PrecinctReference[]> {
  if (!Number.isFinite(countyId) || countyId <= 0) return [];
  try {
    const rows = await sql<{
      id: string | number;
      county_id: string | number;
      precinct_key: string;
      canonical_precinct_code: string | null;
      canonical_precinct_name: string | null;
      status: string;
      effective_start_date: string | null;
      effective_end_date: string | null;
    }[]>`
      select
        id,
        county_id,
        precinct_key,
        canonical_precinct_code,
        canonical_precinct_name,
        status,
        effective_start_date::text as effective_start_date,
        effective_end_date::text as effective_end_date
      from geo_precincts
      where county_id = ${countyId}
      order by precinct_key asc
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      countyId: Number(row.county_id),
      precinctKey: row.precinct_key,
      canonicalPrecinctCode: row.canonical_precinct_code,
      canonicalPrecinctName: row.canonical_precinct_name,
      status: row.status,
      effectiveStartDate: row.effective_start_date,
      effectiveEndDate: row.effective_end_date,
    }));
  } catch {
    return [];
  }
}

/** Pending crosswalk suggestions (awaiting review), treated as unresolved alias targets. */
export async function getUnresolvedPrecinctAliases(): Promise<
  Array<{
    countyId: number;
    sourceSystem: string;
    sourceNormalizedKey: string;
    sourceDisplay: string | null;
    matchScore: number;
    reviewStatus: string;
  }>
> {
  try {
    const rows = await sql<{
      county_id: string | number;
      source_system: string;
      source_normalized_key: string;
      source_display: string | null;
      match_score: string | number;
      review_status: string;
    }[]>`
      select county_id, source_system, source_normalized_key, source_display,
             match_score, review_status
      from precinct_crosswalk_suggestions
      where review_status = 'pending'
      order by county_id, source_normalized_key
    `;
    return rows.map((row) => ({
      countyId: Number(row.county_id),
      sourceSystem: row.source_system,
      sourceNormalizedKey: row.source_normalized_key,
      sourceDisplay: row.source_display,
      matchScore: Number(row.match_score),
      reviewStatus: row.review_status,
    }));
  } catch {
    return [];
  }
}

export async function getGeographyStatus(): Promise<GeographyStatus> {
  const empty: GeographyStatus = {
    countyCount: 0,
    precinctCount: 0,
    aliasCount: 0,
    crosswalkPendingSuggestions: 0,
    crosswalkExceptions: 0,
  };
  try {
    const [c, p, a] = await Promise.all([
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from geo_counties
      `,
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from geo_precincts
      `,
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from geo_precinct_aliases
      `,
    ]);
    let crosswalkPendingSuggestions = 0;
    let crosswalkExceptions = 0;
    try {
      const [s, e] = await Promise.all([
        sql<[{ n: string | number }]>`
          select count(*)::bigint as n from precinct_crosswalk_suggestions
          where review_status = 'pending'
        `,
        sql<[{ n: string | number }]>`
          select count(*)::bigint as n from precinct_crosswalk_exceptions
        `,
      ]);
      crosswalkPendingSuggestions = Number(s[0]?.n ?? 0);
      crosswalkExceptions = Number(e[0]?.n ?? 0);
    } catch {
      /* sql/005 may not be applied yet */
    }
    return {
      countyCount: Number(c[0]?.n ?? 0),
      precinctCount: Number(p[0]?.n ?? 0),
      aliasCount: Number(a[0]?.n ?? 0),
      crosswalkPendingSuggestions,
      crosswalkExceptions,
    };
  } catch {
    return empty;
  }
}

export async function listPrecinctAliasesForCounty(
  countyId: number,
  limit = 500,
): Promise<PrecinctAlias[]> {
  if (!Number.isFinite(countyId) || countyId <= 0) return [];
  const safeLimit = Math.min(2000, Math.max(1, limit));
  try {
    const rows = await sql<{
      id: string | number;
      precinct_id: string | number;
      county_id: string | number;
      source_system: string;
      source_year: number | null;
      source_precinct_code: string | null;
      source_precinct_name: string | null;
      normalized_source_key: string | null;
      created_at: string;
    }[]>`
      select id, precinct_id, county_id, source_system, source_year,
             source_precinct_code, source_precinct_name, normalized_source_key,
             created_at::text as created_at
      from geo_precinct_aliases
      where county_id = ${countyId}
      order by id desc
      limit ${safeLimit}
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      precinctId: Number(row.precinct_id),
      countyId: Number(row.county_id),
      sourceSystem: row.source_system,
      sourceYear: row.source_year,
      sourcePrecinctCode: row.source_precinct_code,
      sourcePrecinctName: row.source_precinct_name,
      normalizedSourceKey: row.normalized_source_key,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
