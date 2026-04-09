import { NextResponse } from "next/server";
import { getCd2DemTargetPrecincts } from "@/lib/queries/targeting";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "200");
    const maxQ = Number(searchParams.get("maxQuintile") ?? "2");
    const maxQuintile =
      maxQ === 1 || maxQ === 2 || maxQ === 3 || maxQ === 4 || maxQ === 5
        ? maxQ
        : 2;

    const data = await getCd2DemTargetPrecincts({
      limit: Number.isFinite(limit) ? limit : 200,
      maxQuintile,
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        description:
          "CD2 precincts ranked by dem_growth_target_score (density + persuasion near 49% Dem + mobilization + initiative). Lower target_quintile = higher priority.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
