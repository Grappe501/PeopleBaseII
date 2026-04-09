-- Export statewide county priority (CSV-friendly).
select
  county_id,
  county_name,
  state_fips,
  county_fips,

  total_population,
  voting_age_population,

  vr_unique_voters,
  registration_rate_pct,
  vh_unique_voters,
  turnout_rate_pct,

  redistricting_signers,
  marijuana_signers,
  casino_signers,
  ranked_choice_signers,

  dem_pct_2022_governor,
  dem_pct_2024_president,
  dem_pct_2026_sos,
  dem_swing_2022_to_2024,
  dem_swing_2024_to_2026,

  statewide_vote_target,
  county_vote_share_of_state,
  county_target_votes_at_proportional_share,
  expected_turnout_votes,
  county_votes_needed_for_majority_of_expected_turnout,
  expected_democratic_baseline_votes,

  registrations_2025_11_to_2026_11_unique_voters,

  county_turnout_opportunity_score,
  county_registration_opportunity_score,
  county_democratic_baseline_score,
  county_civic_activity_score,
  county_priority_score
from public.statewide_county_master_v
order by county_priority_score desc nulls last, vr_unique_voters desc nulls last, county_name;

