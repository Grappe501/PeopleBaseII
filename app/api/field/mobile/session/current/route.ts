import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type CurrentSessionPayload = {
  volunteerId: number;
  session: {
    sessionId: number;
    turfId: number | null;
    turfName: string | null;
    startedAt: string;
  } | null;
};

function iso(value: Date | string | null): string {
  if (value == null) return new Date(0).toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<CurrentSessionPayload>>> {
  try {
    const { searchParams } = new URL(request.url);
    const volunteerIdRaw = searchParams.get("volunteerId");
    const volunteerId =
      volunteerIdRaw != null && volunteerIdRaw !== "" ? Number(volunteerIdRaw) : 1;

    const rows = await sql<
      Array<{
        id: string | number;
        turf_id: string | number | null;
        turf_name: string | null;
        started_at: Date | string;
      }>
    >`
      select
        s.id,
        s.turf_id,
        t.turf_name,
        s.started_at
      from public.canvass_sessions s
      left join public.turfs t on t.id = s.turf_id
      where s.volunteer_id = ${volunteerId}
        and s.session_status = 'active'
      order by s.started_at desc
      limit 1
    `;

    const s = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        volunteerId,
        session: s
          ? {
              sessionId: Number(s.id),
              turfId: s.turf_id != null ? Number(s.turf_id) : null,
              turfName: s.turf_name,
              startedAt: iso(s.started_at),
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

