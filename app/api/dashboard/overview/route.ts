import { NextResponse } from "next/server";
import { getDashboardOverview } from "@/lib/queries/dashboard";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { DashboardOverview } from "@/lib/types/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardOverview();
    const body: ApiResponse<DashboardOverview> = { success: true, data };
    return NextResponse.json(body);
  } catch (error) {
    const body: ApiResponse<never> = { success: false, error: String(error) };
    return NextResponse.json(
      body,
      { status: 500 }
    );
  }
}
