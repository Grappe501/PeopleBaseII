import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { OrchestratorTickResult } from "@/lib/types/contracts/messaging-orchestration";
import { getMessagingOrchestratorSecret } from "@/lib/env";
import { runMessagingOrchestratorTick } from "@/lib/messaging/orchestrator";
import { secureStringEqual } from "@/lib/server/secure-compare";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse<ApiResponse<OrchestratorTickResult>>> {
  const secret = getMessagingOrchestratorSecret();
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "MESSAGING_ORCHESTRATOR_SECRET is not configured." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !secureStringEqual(token, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const data = await runMessagingOrchestratorTick();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
