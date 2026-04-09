import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingJourneyEnrollmentRow } from "@/lib/types/contracts/messaging-orchestration";
import { enrollInJourney, listEnrollmentsForJourney } from "@/lib/queries/messaging-orchestration";

export const dynamic = "force-dynamic";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request): Promise<NextResponse<ApiResponse<{ rows: MessagingJourneyEnrollmentRow[] }>>> {
  try {
    const u = new URL(req.url);
    const journeyId = u.searchParams.get("journeyId");
    if (!journeyId || !isUuid(journeyId)) {
      return NextResponse.json({ success: false, error: "journeyId (UUID) query param is required." }, { status: 400 });
    }
    const limit = Number(u.searchParams.get("limit") ?? "100");
    const rows = await listEnrollmentsForJourney(journeyId, Number.isFinite(limit) ? limit : 100);
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: number | null }>>> {
  try {
    const body = (await req.json()) as { personId?: string; journeyId?: string };
    if (!body.personId || !isUuid(body.personId)) {
      return NextResponse.json({ success: false, error: "personId (UUID) is required." }, { status: 400 });
    }
    if (!body.journeyId || !isUuid(body.journeyId)) {
      return NextResponse.json({ success: false, error: "journeyId (UUID) is required." }, { status: 400 });
    }
    const id = await enrollInJourney({ personId: body.personId, journeyId: body.journeyId });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
