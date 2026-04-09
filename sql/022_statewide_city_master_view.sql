-- Statewide "city/town" drilldown (Arkansas) at the smallest reliable named-location grain:
-- raw_vr.res_city within county, augmented with Census Place (FIPS) facts when we can match it.
-- Targets stay correlated by allocating county targets proportionally by city VR share.
--
-- Depends on: raw_vr, raw_vr_county_mapped, geo_counties, statewide_county_master_v.
-- Optional joins:
-- - geo_cities (seeded by scripts/sync-census-places.ts)
-- - census_place_acs (place-level ACS facts; keyed by state_fips + place_fips + source_year)
-- Idempotent: safe to re-run.

drop view if exists public.statewide_city_master_v cascade;

create view public.statewide_city_master_v
with (security_invoker = true)
as
with
vr_city as (
  select
    m.mapped_county_id as county_id,
    gc.county_name,
    rv.res_city as city_name_raw,
    public.normalize_geo_name(rv.res_city) as city_key,
    count(distinct coalesce(nullif(trim(rv.voter_id), ''), nullif(trim(rv.key_registrant), '')))::bigint as city_vr_unique_voters
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  join public.geo_counties gc
    on gc.id = m.mapped_county_id
  where m.mapped_county_id is not null
    and gc.state_fips = '05'
    and rv.res_city is not null
    and trim(rv.res_city) <> ''
  group by m.mapped_county_id, gc.county_name, rv.res_city, public.normalize_geo_name(rv.res_city)
),

county_ctx as (
  select
    county_id,
    county_name,
    total_population,
    voting_age_population,
    vr_unique_voters,
    registration_rate_pct,
    turnout_rate_pct,
    dem_pct_2024_president,
    dem_pct_2022_governor,
    county_target_votes_at_proportional_share,
    expected_turnout_votes,
    expected_democratic_baseline_votes,
    county_priority_score
  from public.statewide_county_master_v
),

joined as (
  select
    v.county_id,
    v.county_name,
    v.city_name_raw as city_name,
    v.city_key,
    v.city_vr_unique_voters,
    c.total_population as county_total_population,
    c.voting_age_population as county_voting_age_population,
    c.vr_unique_voters as county_vr_unique_voters,
    c.registration_rate_pct as county_registration_rate_pct,
    c.turnout_rate_pct as county_turnout_rate_pct,
    coalesce(c.dem_pct_2024_president, c.dem_pct_2022_governor, 0) as county_dem_baseline_pct,
    c.county_target_votes_at_proportional_share,
    c.county_priority_score
  from vr_city v
  left join county_ctx c
    on c.county_id = v.county_id
),

geo_place as (
  select
    a.county_id,
    public.normalize_geo_name(gct.city_name) as city_key,
    gct.id as geo_city_id,
    gct.place_fips
  from public.geo_cities gct
  join public.geo_city_primary_county_v a
    on a.geo_city_id = gct.id
  where gct.state_fips = '05'
),

place_acs_latest as (
  select distinct on (state_fips, place_fips)
    state_fips,
    place_fips,
    source_year,
    total_population,
    voting_age_population
  from public.census_place_acs
  where state_fips = '05'
  order by state_fips, place_fips, source_year desc
)

select
  j.county_id,
  j.county_name,
  gp.geo_city_id as city_id,
  gp.place_fips,
  j.city_name,
  j.city_key,

  j.city_vr_unique_voters,
  round(
    100.0 * j.city_vr_unique_voters::numeric / nullif(j.county_vr_unique_voters, 0),
    6
  ) as city_share_of_county_vr_pct,

  -- Correlated population estimates:
  -- Estimate city VAP by scaling city registrants by the county registration rate.
  round(
    j.city_vr_unique_voters::numeric / nullif(j.county_registration_rate_pct, 0) * 100.0,
    0
  )::bigint as city_estimated_voting_age_population,

  -- Estimate city total population by scaling VAP to population using county ratio.
  round(
    (
      j.city_vr_unique_voters::numeric / nullif(j.county_registration_rate_pct, 0) * 100.0
    )
    * (j.county_total_population::numeric / nullif(j.county_voting_age_population, 0)),
    0
  )::bigint as city_estimated_total_population,

  -- Census Place population (when matched); prefer this over the correlated estimate in UI.
  pa.total_population as census_place_total_population,
  pa.voting_age_population as census_place_voting_age_population,

  -- Expected turnout votes for this city under county turnout rate.
  round(
    j.city_vr_unique_voters::numeric * (j.county_turnout_rate_pct::numeric / 100.0),
    0
  )::bigint as city_expected_turnout_votes,

  -- "Possible Dem voters" = expected turnout × county aggregate Dem baseline (no person-level inference).
  round(
    (
      j.city_vr_unique_voters::numeric * (j.county_turnout_rate_pct::numeric / 100.0)
    )
    * (j.county_dem_baseline_pct::numeric / 100.0),
    0
  )::bigint as city_possible_dem_voters,

  -- City vote target under statewide 600k scenario: allocate county target by city VR share.
  round(
    j.county_target_votes_at_proportional_share::numeric
    * j.city_vr_unique_voters::numeric
    / nullif(j.county_vr_unique_voters, 0),
    0
  )::bigint as city_target_votes_at_proportional_share,

  j.county_dem_baseline_pct,
  j.county_turnout_rate_pct,
  j.county_registration_rate_pct,
  j.county_priority_score
from joined j
left join geo_place gp
  on gp.county_id = j.county_id
 and gp.city_key = j.city_key

-- Attach latest place ACS facts when place_fips is present.
-- (Place may span counties; we attach by place_fips only.)
left join place_acs_latest pa
  on pa.place_fips = gp.place_fips
 and pa.state_fips = '05';

comment on view public.statewide_city_master_v is
  'Statewide AR city/town drilldown using raw_vr.res_city within county. Targets are allocated proportionally from county_target_votes_at_proportional_share; population/VAP are correlated estimates using county ACS + rates; when geo_cities + census_place_acs exist, attach Census Place population/VAP.';

