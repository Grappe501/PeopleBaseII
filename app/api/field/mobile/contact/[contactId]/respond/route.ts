import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

type RespondRequest = {
  sessionId: number;
  volunteerId: number;
  responseType: "not_home" | "contact_made" | "bad_address" | "refused" | "skip";
  sentiment?: "very_positive" | "positive" | "mixed" | "negative" | "declined" | "unknown" | null;
  issues?: string[] | null;
  note?: string | null;
  wantsFollowup?: boolean;
  wantsEventInvite?: boolean;
  wantsVolunteerInfo?: boolean;
};

type RespondResponse = { ok: true };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<NextResponse<ApiResponse<RespondResponse>>> {
  try {
    const { contactId } = await params;
    const contactIdNum = Number(contactId);
    if (!Number.isFinite(contactIdNum) || contactIdNum <= 0) {
      return NextResponse.json({ success: false, error: "Invalid contactId" }, { status: 400 });
    }

    const body = (await request.json()) as RespondRequest;
    const sessionId = Number(body.sessionId);
    const volunteerId = Number(body.volunteerId);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid sessionId" }, { status: 400 });
    }
    if (!Number.isFinite(volunteerId) || volunteerId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid volunteerId" }, { status: 400 });
    }

    const issues = Array.isArray(body.issues) ? body.issues : null;

    await sql`
      insert into public.canvass_responses (
        session_id,
        contact_id,
        volunteer_id,
        response_type,
        sentiment,
        issues,
        wants_followup,
        wants_event_invite,
        wants_volunteer_info,
        note
      ) values (
        ${sessionId},
        ${contactIdNum},
        ${volunteerId},
        ${body.responseType},
        ${body.sentiment ?? null},
        ${issues != null ? sql.json(issues) : null},
        ${Boolean(body.wantsFollowup)},
        ${Boolean(body.wantsEventInvite)},
        ${Boolean(body.wantsVolunteerInfo)},
        ${body.note ?? null}
      )
      on conflict (session_id, contact_id)
      do update set
        response_type = excluded.response_type,
        sentiment = excluded.sentiment,
        issues = excluded.issues,
        wants_followup = excluded.wants_followup,
        wants_event_invite = excluded.wants_event_invite,
        wants_volunteer_info = excluded.wants_volunteer_info,
        note = excluded.note
    `;

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

