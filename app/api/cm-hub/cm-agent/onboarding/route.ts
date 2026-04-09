import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CmAgentOnboardingRow, CmAgentOnboardingSaveInput } from "@/lib/types/contracts/cm-agent-onboarding";
import { getLatestCmAgentOnboarding, saveCmAgentOnboarding } from "@/lib/queries/cm-agent-onboarding";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<{ latest: CmAgentOnboardingRow | null }>>> {
  try {
    const latest = await getLatestCmAgentOnboarding();
    return NextResponse.json({ success: true, data: { latest } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<{ saved: CmAgentOnboardingRow }>>> {
  try {
    const body = (await request.json()) as CmAgentOnboardingSaveInput;
    const saved = await saveCmAgentOnboarding(body);
    return NextResponse.json({ success: true, data: { saved } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

