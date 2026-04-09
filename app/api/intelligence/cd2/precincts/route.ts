import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/csv";
import { getCd2PrecinctIntel } from "@/lib/queries/intelligence";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format")?.toLowerCase() ?? "json";
    const limit = Number(searchParams.get("limit") ?? "200");
    const sort =
      searchParams.get("sort") === "headroom" ? "headroom" : "blank_density";

    const rows = await getCd2PrecinctIntel({
      limit: Number.isFinite(limit) ? limit : 200,
      sort,
    });

    if (format === "csv") {
      const headers = [
        "county_id",
        "county_name",
        "precinct_label",
        "registered_voters",
        "baseline_dem_pct",
        "model_expected_dem_pct",
        "county_observed_dem_2024_pct",
        "county_dem_residual_pct",
        "precinct_vs_county_gap_pct",
        "precinct_headroom_to_model_pct",
        "blank_density_score",
        "estimated_dem_votes_if_precinct_matched_model",
        "voter_model_archetype",
      ];
      const flat = rows.map((r) => ({
        county_id: r.countyId,
        county_name: r.countyName,
        precinct_label: r.precinctLabel,
        registered_voters: r.registeredVoters,
        baseline_dem_pct: r.baselineDemPct,
        model_expected_dem_pct: r.modelExpectedDemPct,
        county_observed_dem_2024_pct: r.countyObservedDem2024Pct,
        county_dem_residual_pct: r.countyDemResidualPct,
        precinct_vs_county_gap_pct: r.precinctVsCountyGapPct,
        precinct_headroom_to_model_pct: r.precinctHeadroomToModelPct,
        blank_density_score: r.blankDensityScore,
        estimated_dem_votes_if_precinct_matched_model:
          r.estimatedDemVotesIfPrecinctMatchedModel,
        voter_model_archetype: r.voterModelArchetype,
      }));
      const csv = rowsToCsv(headers, flat);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="cd2_precinct_intel.csv"',
        },
      });
    }

    return NextResponse.json({ success: true, data: rows, meta: { sort } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
