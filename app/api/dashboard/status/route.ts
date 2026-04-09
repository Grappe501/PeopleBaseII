import { NextResponse } from "next/server";
import { getDashboardStatus } from "@/lib/queries/dashboard";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { DashboardStatus } from "@/lib/types/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardStatus();
    const body: ApiResponse<DashboardStatus> = { success: true, data };
    return NextResponse.json(body);
  } catch (error) {
    const body: ApiResponse<never> = { success: false, error: String(error) };
    return NextResponse.json(
      body,
      { status: 500 }
    );
  }
}
