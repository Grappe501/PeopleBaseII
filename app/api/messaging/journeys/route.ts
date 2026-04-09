import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingJourneyRow } from "@/lib/types/contracts/messaging-orchestration";
import { createMessagingJourney, listMessagingJourneys } from "@/lib/queries/messaging-orchestration";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<{ rows: MessagingJourneyRow[] }>>> {
  try {
    const rows = await listMessagingJourneys();
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const body = (await req.json()) as {
      journeyName?: string;
      journeyType?: MessagingJourneyRow["journeyType"];
      objectiveId?: string | null;
      audienceId?: string | null;
      status?: MessagingJourneyRow["status"];
      createdBy?: string | null;
    };
    if (!body.journeyName?.trim()) {
      return NextResponse.json({ success: false, error: "journeyName is required." }, { status: 400 });
    }
    const id = await createMessagingJourney({
      journeyName: body.journeyName.trim(),
      journeyType: body.journeyType ?? "other",
      objectiveId: body.objectiveId ?? null,
      audienceId: body.audienceId ?? null,
      status: body.status ?? "draft",
      createdBy: body.createdBy ?? null,
    });
    if (!id) {
      return NextResponse.json({ success: false, error: "Failed to create journey." }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
