import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { DashboardPagePayload } from "@/lib/types/contracts/dashboard-page";
import { getDashboardOverview, getDashboardStatus, getCountySummary } from "@/lib/queries/dashboard";
import { getGeographyStatus } from "@/lib/queries/geography";
import { getCensusCountyRows, getCensusStatus } from "@/lib/queries/census";
import { getBlsStatus, getLatestBlsCountySummary } from "@/lib/queries/bls";
import { getElectionStatus, listElections } from "@/lib/queries/elections";
import {
  getCountyAnalyticsOverview,
  getCountyPowerProfiles,
  getCountyRegistrationGaps,
} from "@/lib/queries/analytics";
import { getCd2IntelSummary } from "@/lib/queries/intelligence";
import { getCd2SegmentHotspots, getCd2SegmentSummary } from "@/lib/queries/voter-scorecard";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<DashboardPagePayload>>> {
  try {
    let intelSummary: Awaited<ReturnType<typeof getCd2IntelSummary>> | null = null;
    let intelError: string | null = null;
    try {
      intelSummary = await getCd2IntelSummary();
    } catch (e) {
      intelError = String(e);
    }

    let segmentSummary: Awaited<ReturnType<typeof getCd2SegmentSummary>> | null = null;
    let segmentHotspots: Awaited<ReturnType<typeof getCd2SegmentHotspots>> | null = null;
    let segmentError: string | null = null;
    try {
      [segmentSummary, segmentHotspots] = await Promise.all([
        getCd2SegmentSummary(),
        getCd2SegmentHotspots({ segment: "persuadable", limit: 15 }),
      ]);
    } catch (e) {
      segmentError = String(e);
    }

    const [
      analyticsOverview,
      powerProfiles,
      registrationGaps,
      overview,
      countySummary,
      status,
      geoStatus,
      censusStatus,
      censusSample,
      blsStatus,
      blsSample,
      electionStatus,
      recentElections,
    ] = await Promise.all([
      getCountyAnalyticsOverview(),
      getCountyPowerProfiles(),
      getCountyRegistrationGaps("penetrationAsc"),
      getDashboardOverview(),
      getCountySummary(25),
      getDashboardStatus(),
      getGeographyStatus(),
      getCensusStatus(),
      getCensusCountyRows(10),
      getBlsStatus(),
      getLatestBlsCountySummary(10),
      getElectionStatus(),
      listElections(8),
    ]);

    const payload: DashboardPagePayload = {
      overview,
      status,
      countySummary,
      geoStatus,
      censusStatus,
      censusSample,
      blsStatus,
      blsSample,
      electionStatus,
      recentElections,
      analyticsOverview,
      powerProfiles,
      registrationGaps,
      intelligence: { cd2Summary: intelSummary, error: intelError },
      segments: { summary: segmentSummary, hotspots: segmentHotspots, error: segmentError },
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

