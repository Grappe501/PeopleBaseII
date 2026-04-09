-- Export statewide precinct priority (CSV-friendly).
select
  county_id,
  county_name,
  precinct_label,
  registered_voters,
  turnout_voters,
  turnout_rate_pct,
  total_votes_2022_governor,
  dem_pct_2022_governor,
  total_votes_2024_president,
  dem_pct_2024_president,
  total_votes_2026_primary,
  dem_pct_2026_primary,
  dem_swing_2022_to_2024,
  dem_swing_2024_to_2026,
  precinct_size_score,
  precinct_turnout_gap_score,
  precinct_baseline_score,
  precinct_priority_score
from public.statewide_precinct_priority_v
order by precinct_priority_score desc nulls last, registered_voters desc nulls last, county_name, precinct_label
limit 20000;

