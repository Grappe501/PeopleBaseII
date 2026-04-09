import { NextResponse } from "next/server";
import { getCountySummary } from "@/lib/queries/dashboard";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { CountySummaryRow } from "@/lib/types/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const parsed = Number(limitParam);
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 25;

    const data = await getCountySummary(limit);
    const body: ApiResponse<{ rows: CountySummaryRow[]; limit: number }> = {
      success: true,
      data: { rows: data, limit },
    };
    return NextResponse.json(body);
  } catch (error) {
    const body: ApiResponse<never> = { success: false, error: String(error) };
    return NextResponse.json(
      body,
      { status: 500 }
    );
  }
}