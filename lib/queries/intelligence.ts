import sql from "@/lib/db";
import type {
  Cd2CountyIntelRow,
  Cd2PrecinctIntelRow,
  Cd2IntelSummary,
} from "@/lib/types/intelligence";

export async function getCd2CountyIntel(): Promise<Cd2CountyIntelRow[]> {
  const rows = await sql<
    {
      county_id: string | number;
      county_name: string | null;
      county_observed_dem_2024_pct: string | number | null;
      model_expected_dem_pct: string | number | null;
      county_dem_residual_pct: string | number | null;
      county_model_bucket: string | null;
      pct_black_population: string | number | null;
      poverty_rate_pct: string | number | null;
      bls_unemployment_rate_pct: string | number | null;
    }[]
  >`
    select
      county_id,
      county_name,
      county_observed_dem_2024_pct,
      model_expected_dem_pct,
      county_dem_residual_pct,
      county_model_bucket,
      pct_black_population,
      poverty_rate_pct,
      bls_unemployment_rate_pct
    from public.cd2_county_intel_v
    order by county_name asc
  `;

  return rows.map((r) => ({
    countyId: r.county_id,
    countyName: r.county_name,
    countyObservedDem2024Pct:
      r.county_observed_dem_2024_pct != null
        ? Number(r.county_observed_dem_2024_pct)
        : null,
    modelExpectedDemPct:
      r.model_expected_dem_pct != null ? Number(r.model_expected_dem_pct) : null,
    countyDemResidualPct:
      r.county_dem_residual_pct != null ? Number(r.county_dem_residual_pct) : null,
    countyModelBucket: r.county_model_bucket,
    pctBlackPopulation:
      r.pct_black_population != null ? Number(r.pct_black_population) : null,
    povertyRatePct: r.poverty_rate_pct != null ? Number(r.poverty_rate_pct) : null,
    blsUnemploymentRatePct:
      r.bls_unemployment_rate_pct != null
        ? Number(r.bls_unemployment_rate_pct)
        : null,
  }));
}

export async function getCd2PrecinctIntel(options: {
  limit?: number;
  sort?: "blank_density" | "headroom";
}): Promise<Cd2PrecinctIntelRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 150, 1), 2000);
  const orderBy =
    options.sort === "headroom"
      ? "precinct_headroom_to_model_pct desc nulls last, blank_density_score desc nulls last"
      : "blank_density_score desc nulls last, estimated_dem_votes_if_precinct_matched_model desc nulls last";

  const rows = await sql.unsafe<
    {
      county_id: string | number;
      county_name: string | null;
      precinct_label: string | null;
      registered_voters: string | number | null;
      baseline_dem_pct: string | number | null;
      model_expected_dem_pct: string | number | null;
      county_observed_dem_2024_pct: string | number | null;
      county_dem_residual_pct: string | number | null;
      precinct_vs_county_gap_pct: string | number | null;
      precinct_headroom_to_model_pct: string | number | null;
      blank_density_score: string | number | null;
      estimated_dem_votes_if_precinct_matched_model: string | number | null;
      voter_model_archetype: string | null;
    }[]
  >(
    `select
      county_id,
      county_name,
      precinct_label,
      registered_voters,
      baseline_dem_pct,
      model_expected_dem_pct,
      county_observed_dem_2024_pct,
      county_dem_residual_pct,
      precinct_vs_county_gap_pct,
      precinct_headroom_to_model_pct,
      blank_density_score,
      estimated_dem_votes_if_precinct_matched_model,
      voter_model_archetype
    from public.cd2_precinct_intel_v
    order by ${orderBy}
    limit ${limit}`,
  );

  return rows.map((r) => ({
    countyId: r.county_id,
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    registeredVoters:
      r.registered_voters != null ? Number(r.registered_voters) : null,
    baselineDemPct: r.baseline_dem_pct != null ? Number(r.baseline_dem_pct) : null,
    modelExpectedDemPct:
      r.model_expected_dem_pct != null ? Number(r.model_expected_dem_pct) : null,
    countyObservedDem2024Pct:
      r.county_observed_dem_2024_pct != null
        ? Number(r.county_observed_dem_2024_pct)
        : null,
    countyDemResidualPct:
      r.county_dem_residual_pct != null
        ? Number(r.county_dem_residual_pct)
        : null,
    precinctVsCountyGapPct:
      r.precinct_vs_county_gap_pct != null
        ? Number(r.precinct_vs_county_gap_pct)
        : null,
    precinctHeadroomToModelPct:
      r.precinct_headroom_to_model_pct != null
        ? Number(r.precinct_headroom_to_model_pct)
        : null,
    blankDensityScore:
      r.blank_density_score != null ? Number(r.blank_density_score) : null,
    estimatedDemVotesIfPrecinctMatchedModel:
      r.estimated_dem_votes_if_precinct_matched_model != null
        ? Number(r.estimated_dem_votes_if_precinct_matched_model)
        : null,
    voterModelArchetype: r.voter_model_archetype,
  }));
}

export async function getCd2IntelSummary(): Promise<Cd2IntelSummary> {
  const [counties, topPrecincts] = await Promise.all([
    getCd2CountyIntel(),
    getCd2PrecinctIntel({ limit: 8, sort: "blank_density" }),
  ]);

  const underperforming = counties.filter(
    (c) => c.countyModelBucket === "underperforming_model",
  ).length;

  return {
    counties,
    topPrecinctsByBlankDensity: topPrecincts,
    stats: {
      cd2CountyCount: counties.length,
      countiesUnderperformingModel: underperforming,
    },
  };
}
