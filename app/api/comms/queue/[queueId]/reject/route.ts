import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { rejectCommsQueue } from "@/lib/queries/comms";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ queueId: string }> },
): Promise<NextResponse<ApiResponse<{ ok: boolean }>>> {
  try {
    const { queueId } = await ctx.params;
    const id = Number(queueId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Invalid queue id." }, { status: 400 });
    }
    const body = (await req.json()) as { rejectedBy?: string | null; reason?: string };
    const reason = (body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ success: false, error: "reason is required." }, { status: 400 });
    }
    const ok = await rejectCommsQueue(id, body.rejectedBy ?? null, reason);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Reject failed (not pending approval or not found)." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
