import sql from "@/lib/db";
import type {
  CountyCityRow,
  CountyDetailRow,
  CountyPrecinctRow,
  StatewideCountyRow,
} from "@/lib/types/county-pages";

export async function listStatewideCounties(options?: {
  limit?: number;
  q?: string;
}): Promise<StatewideCountyRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 75, 1), 200);
  const q = options?.q?.trim() ?? "";

  const rows = await sql<
    {
      county_id: string | number;
      county_name: string;
      county_key: string | null;
      county_fips: string | null;
      vr_unique_voters: string | number | null;
      expected_turnout_votes: string | number | null;
      county_target_votes_at_proportional_share: string | number | null;
      county_priority_score: string | number | null;
    }[]
  >`
    select
      cm.county_id,
      cm.county_name,
      gc.county_key,
      cm.county_fips,
      cm.vr_unique_voters,
      cm.expected_turnout_votes,
      cm.county_target_votes_at_proportional_share,
      cm.county_priority_score
    from public.statewide_county_master_v cm
    left join public.geo_counties gc
      on gc.id = cm.county_id
    where (${q} = '' or cm.county_name ilike ${"%" + q + "%"})
    order by cm.county_priority_score desc nulls last, cm.vr_unique_voters desc nulls last, cm.county_name
    limit ${limit}
  `;

  return rows.map((r) => ({
    countyId: Number(r.county_id),
    countyName: r.county_name,
    countyKey: r.county_key,
    countyFips: r.county_fips,
    vrUniqueVoters: Number(r.vr_unique_voters ?? 0),
    expectedTurnoutVotes: Number(r.expected_turnout_votes ?? 0),
    countyTargetVotes: Number(r.county_target_votes_at_proportional_share ?? 0),
    countyPriorityScore: r.county_priority_score != null ? Number(r.county_priority_score) : null,
  }));
}

export async function getCountyDetailByKey(
  countyKey: string,
): Promise<CountyDetailRow | null> {
  const key = countyKey.trim();
  if (!key) return null;

  const rows = await sql<
    {
      county_id: string | number;
      county_name: string;
      county_key: string | null;
      state_fips: string;
      county_fips: string;
      total_population: string | number | null;
      voting_age_population: string | number | null;
      vr_unique_voters: string | number | null;
      registration_rate_pct: string | number | null;
      vh_unique_voters: string | number | null;
      turnout_rate_pct: string | number | null;
      dem_pct_2022_governor: string | number | null;
      dem_pct_2024_president: string | number | null;
      dem_pct_2026_sos: string | number | null;
      statewide_vote_target: string | number | null;
      county_target_votes_at_proportional_share: string | number | null;
      expected_turnout_votes: string | number | null;
      expected_democratic_baseline_votes: string | number | null;
      county_priority_score: string | number | null;
      top_precincts_by_priority: unknown[] | null;
    }[]
  >`
    select
      cm.county_id,
      cm.county_name,
      gc.county_key,
      cm.state_fips,
      cm.county_fips,
      cm.total_population,
      cm.voting_age_population,
      cm.vr_unique_voters,
      cm.registration_rate_pct,
      cm.vh_unique_voters,
      cm.turnout_rate_pct,
      cm.dem_pct_2022_governor,
      cm.dem_pct_2024_president,
      cm.dem_pct_2026_sos,
      cm.statewide_vote_target,
      cm.county_target_votes_at_proportional_share,
      cm.expected_turnout_votes,
      cm.expected_democratic_baseline_votes,
      cm.county_priority_score,
      cm.top_precincts_by_priority
    from public.county_detail_export_v cm
    join public.geo_counties gc
      on gc.id = cm.county_id
    where gc.county_key = ${key}
    limit 1
  `;

  const r = rows[0];
  if (!r) return null;

  return {
    countyId: Number(r.county_id),
    countyName: r.county_name,
    countyKey: r.county_key,
    stateFips: r.state_fips,
    countyFips: r.county_fips,
    totalPopulation: r.total_population != null ? Number(r.total_population) : null,
    votingAgePopulation: r.voting_age_population != null ? Number(r.voting_age_population) : null,
    vrUniqueVoters: Number(r.vr_unique_voters ?? 0),
    registrationRatePct: r.registration_rate_pct != null ? Number(r.registration_rate_pct) : null,
    vhUniqueVoters: Number(r.vh_unique_voters ?? 0),
    turnoutRatePct: r.turnout_rate_pct != null ? Number(r.turnout_rate_pct) : null,
    demPct2022Governor: r.dem_pct_2022_governor != null ? Number(r.dem_pct_2022_governor) : null,
    demPct2024President: r.dem_pct_2024_president != null ? Number(r.dem_pct_2024_president) : null,
    demPct2026Sos: r.dem_pct_2026_sos != null ? Number(r.dem_pct_2026_sos) : null,
    statewideVoteTarget: Number(r.statewide_vote_target ?? 600000),
    countyTargetVotes: Number(r.county_target_votes_at_proportional_share ?? 0),
    expectedTurnoutVotes: Number(r.expected_turnout_votes ?? 0),
    expectedDemocraticBaselineVotes: Number(r.expected_democratic_baseline_votes ?? 0),
    countyPriorityScore: r.county_priority_score != null ? Number(r.county_priority_score) : null,
    topPrecinctsByPriority: Array.isArray(r.top_precincts_by_priority)
      ? r.top_precincts_by_priority
      : null,
  };
}

export async function listCountyCitiesByKey(
  countyKey: string,
  options?: { limit?: number },
): Promise<CountyCityRow[]> {
  const key = countyKey.trim();
  if (!key) return [];
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 500);

  const rows = await sql<
    {
      county_id: string | number;
      county_name: string;
      city_key: string;
      city_name: string;
      city_vr_unique_voters: string | number | null;
      city_estimated_total_population: string | number | null;
      census_place_total_population: string | number | null;
      census_place_voting_age_population: string | number | null;
      city_expected_turnout_votes: string | number | null;
      city_possible_dem_voters: string | number | null;
      city_target_votes_at_proportional_share: string | number | null;
    }[]
  >`
    select
      c.county_id,
      c.county_name,
      c.city_key,
      c.city_name,
      c.city_vr_unique_voters,
      c.city_estimated_total_population,
      c.census_place_total_population,
      c.census_place_voting_age_population,
      c.city_expected_turnout_votes,
      c.city_possible_dem_voters,
      c.city_target_votes_at_proportional_share
    from public.statewide_city_master_v c
    join public.geo_counties gc
      on gc.id = c.county_id
    where gc.county_key = ${key}
    order by c.city_vr_unique_voters desc nulls last, c.city_name
    limit ${limit}
  `;

  return rows.map((r) => ({
    countyId: Number(r.county_id),
    countyName: r.county_name,
    cityKey: r.city_key,
    cityName: r.city_name,
    cityVrUniqueVoters: Number(r.city_vr_unique_voters ?? 0),
    cityEstimatedTotalPopulation:
      r.city_estimated_total_population != null ? Number(r.city_estimated_total_population) : null,
    censusPlaceTotalPopulation:
      r.census_place_total_population != null ? Number(r.census_place_total_population) : null,
    censusPlaceVotingAgePopulation:
      r.census_place_voting_age_population != null
        ? Number(r.census_place_voting_age_population)
        : null,
    cityExpectedTurnoutVotes: Number(r.city_expected_turnout_votes ?? 0),
    cityPossibleDemVoters: Number(r.city_possible_dem_voters ?? 0),
    cityTargetVotes: Number(r.city_target_votes_at_proportional_share ?? 0),
  }));
}

export async function listCountyPrecinctsByKey(
  countyKey: string,
  options?: { limit?: number },
): Promise<CountyPrecinctRow[]> {
  const key = countyKey.trim();
  if (!key) return [];
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 2000);

  const rows = await sql<
    {
      county_id: string | number;
      county_name: string;
      precinct_label: string;
      registered_voters: string | number | null;
      turnout_voters: string | number | null;
      turnout_rate_pct: string | number | null;
      dem_pct_2024_president: string | number | null;
      precinct_priority_score: string | number | null;
    }[]
  >`
    select
      p.county_id,
      p.county_name,
      p.precinct_label,
      p.registered_voters,
      p.turnout_voters,
      p.turnout_rate_pct,
      p.dem_pct_2024_president,
      p.precinct_priority_score
    from public.statewide_precinct_priority_v p
    join public.geo_counties gc
      on gc.id = p.county_id
    where gc.county_key = ${key}
    order by p.precinct_priority_score desc nulls last, p.registered_voters desc nulls last, p.precinct_label
    limit ${limit}
  `;

  return rows.map((r) => ({
    countyId: Number(r.county_id),
    countyName: r.county_name,
    precinctLabel: r.precinct_label,
    registeredVoters: r.registered_voters != null ? Number(r.registered_voters) : null,
    turnoutVoters: r.turnout_voters != null ? Number(r.turnout_voters) : null,
    turnoutRatePct: r.turnout_rate_pct != null ? Number(r.turnout_rate_pct) : null,
    demPct2024President: r.dem_pct_2024_president != null ? Number(r.dem_pct_2024_president) : null,
    precinctPriorityScore:
      r.precinct_priority_score != null ? Number(r.precinct_priority_score) : null,
  }));
}

