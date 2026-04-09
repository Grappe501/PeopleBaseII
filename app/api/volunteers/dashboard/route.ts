import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { VolunteersDashboardPagePayload } from "@/lib/types/contracts/volunteers-pages";
import { getVolunteersDashboardPayload } from "@/lib/queries/volunteers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<VolunteersDashboardPagePayload>>> {
  try {
    const data = await getVolunteersDashboardPayload();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

