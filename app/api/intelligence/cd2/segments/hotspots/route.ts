import { NextResponse } from "next/server";
import { getCd2SegmentHotspots } from "@/lib/queries/voter-scorecard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get("segment") ?? "persuadable";
    const limit = Number(searchParams.get("limit") ?? "25");

    const data = await getCd2SegmentHotspots({
      segment,
      limit: Number.isFinite(limit) ? limit : 25,
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { segment },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
