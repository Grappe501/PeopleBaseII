import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type VolunteerLookupRow = { volunteerId: number; name: string; countyName: string | null };

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: VolunteerLookupRow[] }>>> {
  try {
    const rows = await sql<
      Array<{
        id: string | number;
        first_name: string | null;
        last_name: string | null;
        county_name: string | null;
      }>
    >`
      select
        v.id,
        v.first_name,
        v.last_name,
        gc.county_name
      from public.volunteers v
      left join public.geo_counties gc on gc.id = v.county_id
      order by v.id desc
      limit 250
    `;
    return NextResponse.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          volunteerId: Number(r.id),
          name: (r.first_name || r.last_name)
            ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
            : `Volunteer #${Number(r.id)}`,
          countyName: r.county_name,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

