import sql from "@/lib/db";
import type {
  CountySummaryRow,
  DashboardOverview,
  DashboardStatus,
} from "@/lib/types/dashboard";

type RawVrColumnMap = {
  county: string | null;
  voterId: string | null;
  importedAt: string | null;
};

const SAFE_COLUMNS = new Set([
  "County",
  "county",
  "VoterID",
  "voter_id",
  "imported_at",
  "created_at",
]);

function asSafeColumn(column: string | null) {
  if (!column || !SAFE_COLUMNS.has(column)) return null;
  return `"${column.replaceAll('"', '""')}"`;
}

async function getRawVrColumnMap(): Promise<RawVrColumnMap> {
  const columns = await sql<[{ column_name: string }]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'raw_vr'
  `;

  const set = new Set(columns.map((row) => row.column_name));

  const county = set.has("County")
    ? "County"
    : set.has("county")
      ? "county"
      : null;

  const voterId = set.has("VoterID")
    ? "VoterID"
    : set.has("voter_id")
      ? "voter_id"
      : null;

  const importedAt = set.has("imported_at")
    ? "imported_at"
    : set.has("created_at")
      ? "created_at"
      : null;

  return { county, voterId, importedAt };
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  try {
    const map = await getRawVrColumnMap();

    const countyColumn = asSafeColumn(map.county);
    const importedAtColumn = asSafeColumn(map.importedAt);

    const overviewQuery = await sql.unsafe<[
      {
        total_rows: string | number;
        county_count: string | number;
        last_imported_at: string | null;
      },
    ]>(`
      select
        count(*)::bigint as total_rows,
        ${countyColumn ? `count(distinct ${countyColumn})::bigint` : "0::bigint"} as county_count,
        ${importedAtColumn ? `max(${importedAtColumn})::text` : "null::text"} as last_imported_at
      from raw_vr
    `);

    const heartbeatQuery = await sql<[{ now_utc: string }]>`
      select now()::text as now_utc
    `;

    const row = overviewQuery[0];

    return {
      totalRawVrRows: Number(row?.total_rows ?? 0),
      countyCount: Number(row?.county_count ?? 0),
      lastImportedAt: row?.last_imported_at ?? null,
      databaseTime: heartbeatQuery[0]?.now_utc ?? null,
      databaseOnline: true,
    };
  } catch {
    return {
      totalRawVrRows: 0,
      countyCount: 0,
      lastImportedAt: null,
      databaseTime: null,
      databaseOnline: false,
    };
  }
}

export async function getCountySummary(limit = 25): Promise<CountySummaryRow[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 25;
  // Prefer the statewide county master view when present (richer + correlated metrics).
  try {
    const viewRows = await sql<
      Array<{
        county_id: number;
        county_name: string;
        county_key: string;
        vr_voters: string | number | null;
        vr_unique_voters: string | number | null;
        registration_rate_pct: string | number | null;
        vh_unique_voters: string | number | null;
        turnout_rate_pct: string | number | null;
        expected_turnout_votes: string | number | null;
        registrations_2025_11_to_2026_11_unique_voters: string | number | null;
        county_priority_score: string | number | null;
      }>
    >`
      select
        m.county_id,
        m.county_name,
        gc.county_key,
        m.vr_voters,
        m.vr_unique_voters,
        m.registration_rate_pct,
        m.vh_unique_voters,
        m.turnout_rate_pct,
        m.expected_turnout_votes,
        m.registrations_2025_11_to_2026_11_unique_voters,
        m.county_priority_score
      from public.statewide_county_master_v m
      join public.geo_counties gc on gc.id = m.county_id
      where gc.state_fips = '05'
      order by m.county_priority_score desc nulls last, m.vr_unique_voters desc nulls last, m.county_name asc
      limit ${safeLimit}
    `;

    return viewRows.map((r) => ({
      county: r.county_name,
      countyId: r.county_id,
      countyKey: r.county_key,
      voterCount: Number(r.vr_voters ?? 0),
      uniqueVoterCount: Number(r.vr_unique_voters ?? 0),
      registeredVoters: r.vr_unique_voters == null ? null : Number(r.vr_unique_voters),
      expectedTurnoutVotes: r.expected_turnout_votes == null ? null : Number(r.expected_turnout_votes),
      registrationRatePct: r.registration_rate_pct == null ? null : Number(r.registration_rate_pct),
      turnoutRatePct: r.turnout_rate_pct == null ? null : Number(r.turnout_rate_pct),
      countyPriorityScore: r.county_priority_score == null ? null : Number(r.county_priority_score),
      registrationsWindowUniqueVoters:
        r.registrations_2025_11_to_2026_11_unique_voters == null
          ? null
          : Number(r.registrations_2025_11_to_2026_11_unique_voters),
    }));
  } catch {
    // Fallback: raw_vr group-by for early-stage DBs.
    const map = await getRawVrColumnMap();

    const countyColumn = asSafeColumn(map.county);
    const voterIdColumn = asSafeColumn(map.voterId);

    if (!countyColumn) {
      return [];
    }

    const rows = await sql.unsafe<
      Array<{
        county: string | null;
        voter_count: string | number;
        unique_voter_count: string | number;
      }>
    >(`
      select
        ${countyColumn}::text as county,
        count(*)::bigint as voter_count,
        ${voterIdColumn ? `count(distinct ${voterIdColumn})::bigint` : "count(*)::bigint"} as unique_voter_count
      from raw_vr
      where ${countyColumn} is not null
        and trim(${countyColumn}::text) <> ''
      group by 1
      order by voter_count desc, county asc
      limit ${safeLimit}
    `);

    return rows.map((row) => ({
      county: row.county ?? "Unknown",
      voterCount: Number(row.voter_count ?? 0),
      uniqueVoterCount: Number(row.unique_voter_count ?? 0),
    }));
  }
}

export async function getDashboardStatus(): Promise<DashboardStatus> {
  const empty: DashboardStatus = {
    hasCountyColumn: false,
    hasVoterIdColumn: false,
    rowsWithCounty: 0,
    rowsWithVoterId: 0,
    distinctVoterIds: 0,
    duplicateResidue: 0,
  };
  try {
    const map = await getRawVrColumnMap();
    const countyColumn = asSafeColumn(map.county);
    const voterIdColumn = asSafeColumn(map.voterId);
    if (!countyColumn && !voterIdColumn) {
      return { ...empty, hasCountyColumn: false, hasVoterIdColumn: false };
    }

    const rows = await sql.unsafe<
      Array<{
        rows_with_county: string | number;
        rows_with_voter_id: string | number;
        distinct_voter_ids: string | number;
        total_rows: string | number;
      }>
    >(`
      select
        count(*) filter (where ${countyColumn ? `${countyColumn} is not null and trim(${countyColumn}::text) <> ''` : "false"})::bigint as rows_with_county,
        count(*) filter (where ${voterIdColumn ? `${voterIdColumn} is not null and trim(${voterIdColumn}::text) <> ''` : "false"})::bigint as rows_with_voter_id,
        ${voterIdColumn ? `count(distinct ${voterIdColumn}) filter (where ${voterIdColumn} is not null and trim(${voterIdColumn}::text) <> '')` : "0::bigint"} as distinct_voter_ids,
        count(*)::bigint as total_rows
      from raw_vr
    `);

    const row = rows[0];
    const totalRows = Number(row?.total_rows ?? 0);
    const distinctVoterIds = Number(row?.distinct_voter_ids ?? 0);
    const rowsWithVoterId = Number(row?.rows_with_voter_id ?? 0);
    const duplicateResidue = Math.max(0, rowsWithVoterId - distinctVoterIds);

    return {
      hasCountyColumn: Boolean(countyColumn),
      hasVoterIdColumn: Boolean(voterIdColumn),
      rowsWithCounty: Number(row?.rows_with_county ?? 0),
      rowsWithVoterId,
      distinctVoterIds,
      duplicateResidue,
    };
  } catch {
    return empty;
  }
}