import { NextResponse } from "next/server";
import { getCd2SegmentSummary } from "@/lib/queries/voter-scorecard";

export async function GET() {
  try {
    const data = await getCd2SegmentSummary();
    const total = data.reduce((s, r) => s + r.voterCount, 0);
    return NextResponse.json({
      success: true,
      data,
      meta: {
        totalVotersScored: total,
        note:
          "Segments are heuristic buckets from dem lean, initiatives, VH, precinct context. Future: donor + list overlays.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
