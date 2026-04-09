import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type TurfLookupRow = { turfId: number; turfName: string; countyName: string | null };

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: TurfLookupRow[] }>>> {
  try {
    const rows = await sql<
      Array<{
        id: string | number;
        turf_name: string;
        county_name: string | null;
      }>
    >`
      select
        t.id,
        t.turf_name,
        gc.county_name
      from public.turfs t
      left join public.geo_counties gc on gc.id = t.county_id
      where t.is_active = true
      order by t.priority_score desc nulls last, t.id desc
      limit 250
    `;
    return NextResponse.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          turfId: Number(r.id),
          turfName: r.turf_name,
          countyName: r.county_name,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

