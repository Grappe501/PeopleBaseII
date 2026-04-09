import sql from "@/lib/db";
import type { BlsLausCountyRow, BlsStatus, BlsSummary } from "@/lib/types/bls";

export async function getBlsStatus(): Promise<BlsStatus> {
  const empty: BlsStatus = {
    tableReady: false,
    lausRowCount: 0,
    qcewRowCount: 0,
    latestLausPeriod: null,
    latestQcewPeriod: null,
  };
  try {
    const [lc, qc, lp, qp] = await Promise.all([
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from bls_laus_county
      `,
      sql<[{ n: string | number }]>`
        select count(*)::bigint as n from bls_qcew_county
      `,
      sql<[{ y: number | null; m: number | null }]>`
        select source_year::int as y, source_month::int as m from bls_laus_county
        order by source_year desc, source_month desc limit 1
      `,
      sql<[{ y: number | null; q: string | null }]>`
        select source_year::int as y, qtr from bls_qcew_county
        order by source_year desc, qtr desc limit 1
      `,
    ]);
    const l = lp[0];
    const p = qp[0];
    return {
      tableReady: true,
      lausRowCount: Number(lc[0]?.n ?? 0),
      qcewRowCount: Number(qc[0]?.n ?? 0),
      latestLausPeriod:
        l?.y != null && l?.m != null ? `${l.y}-${String(l.m).padStart(2, "0")}` : null,
      latestQcewPeriod:
        p?.y != null && p?.q != null ? `${p.y}-${p.q}` : null,
    };
  } catch {
    return empty;
  }
}

export async function getBlsSummary(): Promise<BlsSummary> {
  const s = await getBlsStatus();
  return {
    lausRowCount: s.lausRowCount,
    qcewRowCount: s.qcewRowCount,
    latestLausYearMonth: s.latestLausPeriod,
    latestQcewYearQuarter: s.latestQcewPeriod,
  };
}

export async function getLatestBlsCountySummary(
  limit = 50,
): Promise<Array<BlsLausCountyRow & { countyName: string; countyKey: string }>> {
  const safe = Math.min(200, Math.max(1, limit));
  try {
    const rows = await sql<
      {
        id: string | number;
        county_id: string | number;
        year: number;
        month: number;
        labor_force: string | number | null;
        employment: string | number | null;
        unemployment: string | number | null;
        unemployment_rate: string | number | null;
        county_name: string;
        county_key: string;
      }[]
    >`
      select distinct on (l.county_id)
        l.id, l.county_id, l.source_year as year, l.source_month as month,
        l.labor_force, l.employment, l.unemployment, l.unemployment_rate,
        g.county_name, g.county_key
      from bls_laus_county l
      join geo_counties g on g.id = l.county_id
      order by l.county_id, l.source_year desc, l.source_month desc
      limit ${safe}
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      countyId: Number(row.county_id),
      year: row.year,
      month: row.month,
      laborForce: row.labor_force !== null ? Number(row.labor_force) : null,
      employed: row.employment !== null ? Number(row.employment) : null,
      unemployed: row.unemployment !== null ? Number(row.unemployment) : null,
      unemploymentRate:
        row.unemployment_rate !== null ? Number(row.unemployment_rate) : null,
      countyName: row.county_name,
      countyKey: row.county_key,
    }));
  } catch {
    return [];
  }
}

export async function getCountyEconomicTrend(
  countyKey: string,
  monthsBack = 24,
): Promise<BlsLausCountyRow[]> {
  const key = countyKey.trim();
  if (!key) return [];
  const safeMonths = Math.min(120, Math.max(1, monthsBack));
  try {
    const rows = await sql<
      {
        id: string | number;
        county_id: string | number;
        year: number;
        month: number;
        labor_force: string | number | null;
        employment: string | number | null;
        unemployment: string | number | null;
        unemployment_rate: string | number | null;
      }[]
    >`
      select l.id, l.county_id, l.source_year as year, l.source_month as month,
             l.labor_force, l.employment, l.unemployment, l.unemployment_rate
      from bls_laus_county l
      join geo_counties g on g.id = l.county_id
      where g.county_key = ${key}
      order by l.source_year desc, l.source_month desc
      limit ${safeMonths}
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      countyId: Number(row.county_id),
      year: row.year,
      month: row.month,
      laborForce: row.labor_force !== null ? Number(row.labor_force) : null,
      employed: row.employment !== null ? Number(row.employment) : null,
      unemployed: row.unemployment !== null ? Number(row.unemployment) : null,
      unemploymentRate:
        row.unemployment_rate !== null ? Number(row.unemployment_rate) : null,
    }));
  } catch {
    return [];
  }
}
