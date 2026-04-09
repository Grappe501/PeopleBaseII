import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export type NextContactPayload = {
  sessionId: number;
  contact: {
    contactId: number;
    fullName: string | null;
    address1: string;
    address2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    preferredLanguage: string | null;
  } | null;
  progress: {
    completed: number;
    total: number;
  };
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ turfId: string }> },
): Promise<NextResponse<ApiResponse<NextContactPayload>>> {
  try {
    const { turfId } = await params;
    const turfIdNum = Number(turfId);
    if (!Number.isFinite(turfIdNum) || turfIdNum <= 0) {
      return NextResponse.json({ success: false, error: "Invalid turfId" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const sessionIdNum = Number(searchParams.get("sessionId"));
    if (!Number.isFinite(sessionIdNum) || sessionIdNum <= 0) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    const totals = await sql<Array<{ total: string | number; completed: string | number }>>`
      select
        (select count(*)::bigint from public.canvass_contacts where turf_id = ${turfIdNum}) as total,
        (select count(*)::bigint
           from public.canvass_responses r
           join public.canvass_contacts c on c.id = r.contact_id
          where r.session_id = ${sessionIdNum}
            and c.turf_id = ${turfIdNum}) as completed
    `;
    const total = Number(totals[0]?.total ?? 0);
    const completed = Number(totals[0]?.completed ?? 0);

    const rows = await sql<
      Array<{
        id: string | number;
        full_name: string | null;
        address1: string;
        address2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        preferred_language: string | null;
      }>
    >`
      select
        c.id, c.full_name, c.address1, c.address2, c.city, c.state, c.zip, c.preferred_language
      from public.canvass_contacts c
      where c.turf_id = ${turfIdNum}
        and c.do_not_contact = false
        and not exists (
          select 1 from public.canvass_responses r
          where r.session_id = ${sessionIdNum}
            and r.contact_id = c.id
        )
      order by c.id asc
      limit 1
    `;

    const c = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        sessionId: sessionIdNum,
        contact: c
          ? {
              contactId: Number(c.id),
              fullName: c.full_name,
              address1: c.address1,
              address2: c.address2,
              city: c.city,
              state: c.state,
              zip: c.zip,
              preferredLanguage: c.preferred_language,
            }
          : null,
        progress: { completed, total },
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

