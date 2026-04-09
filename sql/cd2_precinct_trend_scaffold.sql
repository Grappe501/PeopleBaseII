-- CD2 precinct trend scaffold (non-definitive; extend when race keys stabilize).
-- Depends on: election_results (geography_type = precinct), elections, races,
--             election_contests, geo_counties, county_congressional_districts.
-- Not registered in run-sql-migrations.ts — run manually or fold into a later migration.

create or replace view public.cd2_precinct_trend_scaffold_v as
with
cd2 as (
  select ccd.county_id
  from public.county_congressional_districts ccd
  where ccd.state_fips::text = '05'
    and ccd.congressional_district::numeric = 2
),
agg as (
  select
    gc.county_name,
    coalesce(er.location_raw, er.location_label, '') as precinct_label,
    e.election_year as election_year,
    sum(er.votes)::bigint as total_votes,
    sum(er.votes) filter (where coalesce(er.party, '') in ('DEM', 'Democratic'))::bigint as dem_votes
  from public.election_results er
  join public.races r on r.id = er.race_id
  join public.elections e on e.id = r.election_id
  join public.geo_counties gc on gc.id = er.county_id
  join cd2 on cd2.county_id = er.county_id
  where er.geography_type = 'precinct'
    and er.county_id is not null
  group by
    gc.county_name,
    coalesce(er.location_raw, er.location_label, ''),
    e.election_year
)
select
  a.county_name,
  a.precinct_label,
  a.election_year,
  case
    when a.total_votes > 0
    then round(100.0 * a.dem_votes::numeric / a.total_votes::numeric, 4)
  end as dem_pct,
  a.total_votes,
  round(ln(1.0 + a.total_votes::numeric), 4) as precinct_size_score,
  50.0::numeric as precinct_turnout_trend_placeholder_score
from agg a;

comment on view public.cd2_precinct_trend_scaffold_v is
  'Precinct-level totals and rough DEM share by year (party column only; refine with race-specific logic).';
