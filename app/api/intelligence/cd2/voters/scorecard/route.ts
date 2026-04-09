import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/csv";
import { getCd2VoterScorecardRows } from "@/lib/queries/voter-scorecard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format")?.toLowerCase() ?? "json";
    const limit = Number(searchParams.get("limit") ?? "500");
    const offset = Number(searchParams.get("offset") ?? "0");
    const segment = searchParams.get("segment")?.trim() || undefined;

    const rows = await getCd2VoterScorecardRows({
      limit: Number.isFinite(limit) ? limit : 500,
      offset: Number.isFinite(offset) ? offset : 0,
      segment,
    });

    if (format === "csv") {
      const headers = [
        "voter_id",
        "key_registrant",
        "county_id",
        "county_name",
        "precinct_label",
        "dem_lean_score",
        "campaign_engagement_score",
        "funder_potential_proxy_score",
        "segment_bucket",
        "initiative_breadth",
      ];
      const flat = rows.map((r) => ({
        voter_id: r.voterId,
        key_registrant: r.keyRegistrant,
        county_id: r.countyId,
        county_name: r.countyName,
        precinct_label: r.precinctLabel,
        dem_lean_score: r.demLeanScore,
        campaign_engagement_score: r.campaignEngagementScore,
        funder_potential_proxy_score: r.funderPotentialProxyScore,
        segment_bucket: r.segmentBucket,
        initiative_breadth: r.initiativeBreadth,
      }));
      return new NextResponse(rowsToCsv(headers, flat), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="cd2_voter_scorecard.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
