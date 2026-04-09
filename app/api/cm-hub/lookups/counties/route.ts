import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type CountyLookupRow = { countyId: number; countyName: string; countyKey: string | null };

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: CountyLookupRow[] }>>> {
  try {
    const rows = await sql<Array<{ id: string | number; county_name: string; county_key: string | null }>>`
      select id, county_name, county_key
      from public.geo_counties
      where state_fips = '05'
      order by county_name asc
    `;
    return NextResponse.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          countyId: Number(r.id),
          countyName: r.county_name,
          countyKey: r.county_key,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

