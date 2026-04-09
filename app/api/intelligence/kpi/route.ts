import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { KpiIntelligencePayload } from "@/lib/types/contracts/kpi-intelligence";
import { getKpiIntelligencePayload } from "@/lib/queries/kpi-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse<ApiResponse<KpiIntelligencePayload>>> {
  try {
    const u = new URL(req.url);
    const top = Number(u.searchParams.get("top") ?? "15");
    const data = await getKpiIntelligencePayload(Number.isFinite(top) ? top : 15);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
