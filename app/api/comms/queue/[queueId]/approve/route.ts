import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { approveCommsQueue } from "@/lib/queries/comms";

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
    const body = (await req.json().catch(() => ({}))) as { approvedBy?: string | null };
    const ok = await approveCommsQueue(id, body.approvedBy ?? null);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Approve failed (not pending approval or not found)." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
