import sql from "@/lib/db";
import type {
  Cd2DemTargetPrecinctRow,
  Cd2DemTargetVoterRow,
} from "@/lib/types/targeting";

/** Top CD2 precincts for growing aggregate Democratic performance (density + persuasion + mobilization + initiative). */
export async function getCd2DemTargetPrecincts(options: {
  limit?: number;
  /** Include precincts with target_quintile <= this value (1 = top 20% only; 2 = top 40%, default). */
  maxQuintile?: 1 | 2 | 3 | 4 | 5;
}): Promise<Cd2DemTargetPrecinctRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 2000);
  const maxQ = options.maxQuintile ?? 2;

  const rows = await sql<
    {
      county_id: string | number;
      county_name: string | null;
      precinct_label: string | null;
      registered_voters: string | number | null;
      baseline_dem_pct: string | number | null;
      turnout_rate_pct: string | number | null;
      dem_growth_target_score: string | number | null;
      voter_density_weight_0_100: string | number | null;
      persuasion_swing_score_0_100: string | number | null;
      mobilization_blend_score: string | number | null;
      target_quintile: number | null;
      target_tier: string | null;
      precinct_priority_score_balanced: string | number | null;
    }[]
  >`
    select
      county_id,
      county_name,
      precinct_label,
      registered_voters,
      baseline_dem_pct,
      turnout_rate_pct,
      dem_growth_target_score,
      voter_density_weight_0_100,
      persuasion_swing_score_0_100,
      mobilization_blend_score,
      target_quintile,
      target_tier,
      precinct_priority_score_balanced
    from public.cd2_dem_target_precincts_v
    where target_quintile <= ${maxQ}
    order by dem_growth_target_score desc nulls last, registered_voters desc nulls last
    limit ${limit}
  `;

  return rows.map((r) => ({
    countyId: r.county_id,
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    registeredVoters: r.registered_voters != null ? Number(r.registered_voters) : null,
    baselineDemPct: r.baseline_dem_pct != null ? Number(r.baseline_dem_pct) : null,
    turnoutRatePct: r.turnout_rate_pct != null ? Number(r.turnout_rate_pct) : null,
    demGrowthTargetScore:
      r.dem_growth_target_score != null ? Number(r.dem_growth_target_score) : null,
    voterDensityWeight0_100:
      r.voter_density_weight_0_100 != null
        ? Number(r.voter_density_weight_0_100)
        : null,
    persuasionSwingScore0_100:
      r.persuasion_swing_score_0_100 != null
        ? Number(r.persuasion_swing_score_0_100)
        : null,
    mobilizationBlendScore:
      r.mobilization_blend_score != null ? Number(r.mobilization_blend_score) : null,
    targetQuintile: r.target_quintile,
    targetTier: r.target_tier,
    precinctPriorityScoreBalanced:
      r.precinct_priority_score_balanced != null
        ? Number(r.precinct_priority_score_balanced)
        : null,
  }));
}

/**
 * Voters in CD2 precincts with target_quintile 1–2 (see view), ranked by voter_dem_growth_priority_score
 * (precinct growth score × lean headroom × density weight).
 */
export async function getCd2DemTargetVoters(options: {
  limit?: number;
  offset?: number;
  countyId?: number;
}): Promise<Cd2DemTargetVoterRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 5000);
  const offset = Math.max(options.offset ?? 0, 0);

  if (options.countyId != null) {
    const rows = await sql<
      {
        voter_id: string | null;
        key_registrant: string | null;
        county_id: string | number;
        county_name: string | null;
        precinct_label: string | null;
        party_raw: string | null;
        dem_lean_score: string | number | null;
        dem_lean_headroom: string | number | null;
        precinct_dem_growth_target_score: string | number | null;
        precinct_target_quintile: number | null;
        precinct_target_tier: string | null;
        precinct_voter_density_weight_0_100: string | number | null;
        voter_dem_growth_priority_score: string | number | null;
        has_vote_history: boolean;
      }[]
    >`
      select
        voter_id,
        key_registrant,
        county_id,
        county_name,
        precinct_label,
        party_raw,
        dem_lean_score,
        dem_lean_headroom,
        precinct_dem_growth_target_score,
        precinct_target_quintile,
        precinct_target_tier,
        precinct_voter_density_weight_0_100,
        voter_dem_growth_priority_score,
        has_vote_history
      from public.cd2_dem_target_voters_v
      where county_id = ${options.countyId}
      order by voter_dem_growth_priority_score desc nulls last
      limit ${limit}
      offset ${offset}
    `;
    return mapVoterRows(rows);
  }

  const rows = await sql<
    {
      voter_id: string | null;
      key_registrant: string | null;
      county_id: string | number;
      county_name: string | null;
      precinct_label: string | null;
      party_raw: string | null;
      dem_lean_score: string | number | null;
      dem_lean_headroom: string | number | null;
      precinct_dem_growth_target_score: string | number | null;
      precinct_target_quintile: number | null;
      precinct_target_tier: string | null;
      precinct_voter_density_weight_0_100: string | number | null;
      voter_dem_growth_priority_score: string | number | null;
      has_vote_history: boolean;
    }[]
  >`
    select
      voter_id,
      key_registrant,
      county_id,
      county_name,
      precinct_label,
      party_raw,
      dem_lean_score,
      dem_lean_headroom,
      precinct_dem_growth_target_score,
      precinct_target_quintile,
      precinct_target_tier,
      precinct_voter_density_weight_0_100,
      voter_dem_growth_priority_score,
      has_vote_history
    from public.cd2_dem_target_voters_v
    order by voter_dem_growth_priority_score desc nulls last
    limit ${limit}
    offset ${offset}
  `;

  return mapVoterRows(rows);
}

function mapVoterRows(
  rows: {
    voter_id: string | null;
    key_registrant: string | null;
    county_id: string | number;
    county_name: string | null;
    precinct_label: string | null;
    party_raw: string | null;
    dem_lean_score: string | number | null;
    dem_lean_headroom: string | number | null;
    precinct_dem_growth_target_score: string | number | null;
    precinct_target_quintile: number | null;
    precinct_target_tier: string | null;
    precinct_voter_density_weight_0_100: string | number | null;
    voter_dem_growth_priority_score: string | number | null;
    has_vote_history: boolean;
  }[],
): Cd2DemTargetVoterRow[] {
  return rows.map((r) => ({
    voterId: r.voter_id,
    keyRegistrant: r.key_registrant,
    countyId: r.county_id,
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    partyRaw: r.party_raw,
    demLeanScore: r.dem_lean_score != null ? Number(r.dem_lean_score) : null,
    demLeanHeadroom: r.dem_lean_headroom != null ? Number(r.dem_lean_headroom) : null,
    precinctDemGrowthTargetScore:
      r.precinct_dem_growth_target_score != null
        ? Number(r.precinct_dem_growth_target_score)
        : null,
    precinctTargetQuintile: r.precinct_target_quintile,
    precinctTargetTier: r.precinct_target_tier,
    precinctVoterDensityWeight0_100:
      r.precinct_voter_density_weight_0_100 != null
        ? Number(r.precinct_voter_density_weight_0_100)
        : null,
    voterDemGrowthPriorityScore:
      r.voter_dem_growth_priority_score != null
        ? Number(r.voter_dem_growth_priority_score)
        : null,
    hasVoteHistory: r.has_vote_history,
  }));
}
