import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import { submitCommsQueue } from "@/lib/queries/comms";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ queueId: string }> },
): Promise<NextResponse<ApiResponse<{ ok: boolean }>>> {
  try {
    const { queueId } = await ctx.params;
    const id = Number(queueId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Invalid queue id." }, { status: 400 });
    }
    const ok = await submitCommsQueue(id);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Submit failed (not draft or not found)." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
