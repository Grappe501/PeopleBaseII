import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { MessagingJourneyStepRow } from "@/lib/types/contracts/messaging-orchestration";
import { createJourneyStep, listJourneySteps } from "@/lib/queries/messaging-orchestration";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ journeyId: string }> },
): Promise<NextResponse<ApiResponse<{ rows: MessagingJourneyStepRow[] }>>> {
  try {
    const { journeyId } = await ctx.params;
    const rows = await listJourneySteps(journeyId);
    return NextResponse.json({ success: true, data: { rows } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ journeyId: string }> },
): Promise<NextResponse<ApiResponse<{ id: number }>>> {
  try {
    const { journeyId } = await ctx.params;
    const body = (await req.json()) as Partial<{
      stepOrder: number;
      stepType: MessagingJourneyStepRow["stepType"];
      channel: MessagingJourneyStepRow["channel"] | null;
      templateKey: string | null;
      delayAfterPreviousValue: number | null;
      delayAfterPreviousUnit: MessagingJourneyStepRow["delayAfterPreviousUnit"] | null;
      conditionLogic: unknown;
      audienceFilterOverride: unknown;
      requiresApproval: boolean;
    }>;
    if (body.stepOrder == null || !body.stepType) {
      return NextResponse.json(
        { success: false, error: "stepOrder and stepType are required." },
        { status: 400 },
      );
    }
    const id = await createJourneyStep({
      journeyId,
      stepOrder: body.stepOrder,
      stepType: body.stepType,
      channel: body.channel ?? null,
      templateKey: body.templateKey ?? null,
      delayAfterPreviousValue: body.delayAfterPreviousValue ?? 0,
      delayAfterPreviousUnit: body.delayAfterPreviousUnit ?? null,
      conditionLogic: body.conditionLogic,
      audienceFilterOverride: body.audienceFilterOverride,
      requiresApproval: body.requiresApproval ?? true,
    });
    if (id == null) {
      return NextResponse.json({ success: false, error: "Failed to upsert step." }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
