import { NextResponse } from "next/server";
import {
  getPrecinctPerformanceTrend,
  getPrecinctTurnoutGaps,
} from "@/lib/queries/analytics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const precinctKey = searchParams.get("precinctKey")?.trim() ?? "";
    const [turnoutGaps, precinctTrend] = await Promise.all([
      getPrecinctTurnoutGaps(),
      precinctKey
        ? getPrecinctPerformanceTrend(precinctKey)
        : Promise.resolve([]),
    ]);
    return NextResponse.json({
      success: true,
      data: { turnoutGaps, precinctTrend, precinctKeyRequested: precinctKey || null },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
