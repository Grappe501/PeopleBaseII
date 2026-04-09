-- Validation for statewide county/precinct/re-engagement surfaces.
-- Run after: 018_statewide_county_master_view.sql, 019_statewide_precinct_priority_view.sql,
--            020_county_detail_export.sql, 021_statewide_voter_reengagement_view.sql

-- ---------------------------------------------------------------------------
-- 1) County counts (expect 75 AR counties if geo seed is complete)
-- ---------------------------------------------------------------------------
select count(*)::int as statewide_county_master_rows
from public.statewide_county_master_v;

select count(*)::int as geo_counties_ar_rows
from public.geo_counties
where state_fips = '05';

-- ---------------------------------------------------------------------------
-- 2) Null checks on major county fields (should be low; depends on data coverage)
-- ---------------------------------------------------------------------------
select
  county_name,
  county_fips,
  vr_unique_voters,
  voting_age_population,
  registration_rate_pct,
  turnout_rate_pct,
  dem_pct_2022_governor,
  dem_pct_2024_president,
  county_priority_score
from public.statewide_county_master_v
where county_id is null
   or county_name is null
   or county_fips is null;

-- ---------------------------------------------------------------------------
-- 3) Top/bottom counties by priority score
-- ---------------------------------------------------------------------------
select county_name, vr_unique_voters, turnout_rate_pct, registration_rate_pct, county_priority_score
from public.statewide_county_master_v
order by county_priority_score desc nulls last
limit 15;

select county_name, vr_unique_voters, turnout_rate_pct, registration_rate_pct, county_priority_score
from public.statewide_county_master_v
order by county_priority_score asc nulls last
limit 15;

-- ---------------------------------------------------------------------------
-- 4) Precinct coverage counts
-- ---------------------------------------------------------------------------
select count(*)::bigint as statewide_precinct_rows
from public.statewide_precinct_priority_v;

select
  county_name,
  count(*)::bigint as precinct_rows
from public.statewide_precinct_priority_v
group by county_name
order by precinct_rows desc
limit 15;

-- ---------------------------------------------------------------------------
-- 5) Re-engagement distribution
-- ---------------------------------------------------------------------------
select outreach_bucket, count(*)::bigint as voters
from public.statewide_voter_reengagement_v
group by outreach_bucket
order by voters desc;

select
  county_name,
  outreach_bucket,
  count(*)::bigint as voters
from public.statewide_voter_reengagement_v
group by county_name, outreach_bucket
order by county_name, outreach_bucket;

-- ---------------------------------------------------------------------------
-- 6) BLS coverage check (latest views)
-- ---------------------------------------------------------------------------
select
  count(*)::int as counties_with_laus_latest
from public.bls_laus_county_latest;

select
  count(*)::int as counties_with_qcew_latest
from public.bls_qcew_county_latest;

-- ---------------------------------------------------------------------------
-- 7) County detail export sanity
-- ---------------------------------------------------------------------------
select
  county_name,
  jsonb_array_length(coalesce(top_precincts_by_priority, '[]'::jsonb)) as top_precincts_count
from public.county_detail_export_v
order by top_precincts_count desc, county_name
limit 25;

