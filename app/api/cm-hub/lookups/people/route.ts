import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type PeopleLookupRow = {
  personId: string;
  displayName: string;
  countyName: string | null;
};

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: PeopleLookupRow[] }>>> {
  try {
    const rows = await sql<
      Array<{
        person_id: string;
        display_name: string;
        county_name: string | null;
      }>
    >`
      select
        person_id::text as person_id,
        coalesce(display_name, '(unknown)') as display_name,
        county_name
      from public.people_master_v
      order by last_activity_at desc nulls last, display_name asc
      limit 250
    `;
    return NextResponse.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          personId: r.person_id,
          displayName: r.display_name,
          countyName: r.county_name,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

