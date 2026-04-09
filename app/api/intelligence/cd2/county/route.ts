import { NextResponse } from "next/server";
import { rowsToCsv } from "@/lib/csv";
import { getCd2CountyIntel } from "@/lib/queries/intelligence";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format")?.toLowerCase() ?? "json";

    const rows = await getCd2CountyIntel();

    if (format === "csv") {
      const headers = [
        "county_id",
        "county_name",
        "county_observed_dem_2024_pct",
        "model_expected_dem_pct",
        "county_dem_residual_pct",
        "county_model_bucket",
        "pct_black_population",
        "poverty_rate_pct",
        "bls_unemployment_rate_pct",
      ];
      const flat = rows.map((r) => ({
        county_id: r.countyId,
        county_name: r.countyName,
        county_observed_dem_2024_pct: r.countyObservedDem2024Pct,
        model_expected_dem_pct: r.modelExpectedDemPct,
        county_dem_residual_pct: r.countyDemResidualPct,
        county_model_bucket: r.countyModelBucket,
        pct_black_population: r.pctBlackPopulation,
        poverty_rate_pct: r.povertyRatePct,
        bls_unemployment_rate_pct: r.blsUnemploymentRatePct,
      }));
      const csv = rowsToCsv(headers, flat);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="cd2_county_intel.csv"',
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
