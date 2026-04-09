import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingJourneyRow } from "@/lib/types/contracts/messaging-orchestration";
import { getMessagingJourney, updateMessagingJourney } from "@/lib/queries/messaging-orchestration";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ journeyId: string }> },
): Promise<NextResponse<ApiResponse<{ journey: MessagingJourneyRow }>>> {
  try {
    const { journeyId } = await ctx.params;
    const journey = await getMessagingJourney(journeyId);
    if (!journey) {
      return NextResponse.json({ success: false, error: "Journey not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { journey } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ journeyId: string }> },
): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const { journeyId } = await ctx.params;
    const body = (await req.json()) as Partial<{
      journeyName: string;
      journeyType: MessagingJourneyRow["journeyType"];
      objectiveId: string | null;
      audienceId: string | null;
      status: MessagingJourneyRow["status"];
      startDate: string | null;
      endDate: string | null;
    }>;
    const ok = await updateMessagingJourney(journeyId, body);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Journey not found or update failed." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
