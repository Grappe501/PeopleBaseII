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