-- Export top 200,000 statewide re-engagement records (CSV-friendly).
select
  voter_id,
  key_registrant,
  county_id,
  county_name,
  precinct_label,
  registrant_status,
  voted_2022_general,
  voted_2024_general,
  voted_2026_primary,
  voted_2026_runoff,
  voted_any_primary,
  petition_redistricting,
  petition_marijuana,
  petition_casino,
  petition_ranked_choice,
  precinct_turnout_rate_pct,
  county_turnout_rate_pct,
  county_priority_score,
  precinct_priority_score,
  reengagement_score,
  outreach_bucket
from public.statewide_voter_reengagement_v
order by
  reengagement_score desc nulls last,
  county_priority_score desc nulls last,
  precinct_priority_score desc nulls last,
  county_name,
  precinct_label,
  voter_id
limit 200000;

