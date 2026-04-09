import { NextResponse } from "next/server";
import { getCd2DemTargetVoters } from "@/lib/queries/targeting";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "500");
    const offset = Number(searchParams.get("offset") ?? "0");
    const countyIdRaw = searchParams.get("countyId");
    const countyIdParsed =
      countyIdRaw != null && countyIdRaw !== ""
        ? Number(countyIdRaw)
        : undefined;

    const data = await getCd2DemTargetVoters({
      limit: Number.isFinite(limit) ? limit : 500,
      offset: Number.isFinite(offset) ? offset : 0,
      countyId:
        countyIdParsed !== undefined && Number.isFinite(countyIdParsed)
          ? countyIdParsed
          : undefined,
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        description:
          "Voters in CD2 precincts with target_quintile 1–2. dem_lean_score blends VR party with precinct baseline Dem %. voter_dem_growth_priority_score weights precinct growth × lean headroom × density.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
