import { NextResponse } from "next/server";
import { getCountyAnalyticsOverview } from "@/lib/queries/analytics";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CountyAnalyticsOverview } from "@/lib/types/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCountyAnalyticsOverview();
    const body: ApiResponse<CountyAnalyticsOverview> = { success: true, data };
    return NextResponse.json(body);
  } catch (error) {
    const body: ApiResponse<never> = { success: false, error: String(error) };
    return NextResponse.json(
      body,
      { status: 500 },
    );
  }
}
