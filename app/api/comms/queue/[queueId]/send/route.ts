import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { sendCommsQueueItem } from "@/lib/queries/comms";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ queueId: string }> },
): Promise<
  NextResponse<
    ApiResponse<
      | { complianceMessageLogId: number; providerMessageId: string | null }
      | { blocked: true; reason: string }
    >
  >
> {
  try {
    const { queueId } = await ctx.params;
    const id = Number(queueId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Invalid queue id." }, { status: 400 });
    }
    const result = await sendCommsQueueItem(id);
    if (!result.ok) {
      if (result.reason === "blocked") {
        return NextResponse.json({
          success: true,
          data: { blocked: true as const, reason: result.detail ?? "Blocked" },
        });
      }
      if (result.reason === "not_found") {
        return NextResponse.json({ success: false, error: "Queue item not found." }, { status: 404 });
      }
      if (result.reason === "config") {
        return NextResponse.json(
          { success: false, error: result.detail ?? "Provider not configured." },
          { status: 503 },
        );
      }
      if (result.reason === "send") {
        return NextResponse.json(
          { success: false, error: result.detail ?? "Send failed." },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { success: false, error: result.detail ?? "Send not allowed (must be approved)." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        complianceMessageLogId: result.complianceMessageLogId,
        providerMessageId: result.providerMessageId,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
