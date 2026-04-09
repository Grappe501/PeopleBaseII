-- Analytics views (depends on 001–004; raw_vr.county text column for VR joins)
-- Vote share and turnout rate are computed here, not stored on fact tables.
-- County matching uses normalize_geo_name() and raw_vr_county_mapped (see docs/modeling/county-normalization.md).

-- Drop views that reference geo_counties.normalized_county_name before replacing the column.
drop view if exists analytics_county_registration_gap cascade;
drop view if exists analytics_county_power_profile cascade;
drop view if exists diagnostics_vr_mapping_coverage cascade;
drop view if exists diagnostics_county_completeness cascade;
drop view if exists diagnostics_vr_county_coverage cascade;
drop view if exists diagnostics_vr_unmatched_counties cascade;
drop view if exists raw_vr_county_mapped cascade;

-- Canonical county key for string joins (generated from normalize_geo_name(county_name)).
alter table geo_counties
  drop column if exists normalized_county_name;

alter table geo_counties
  add column normalized_county_name text
  generated always as (normalize_geo_name(county_name)) stored;

create index if not exists geo_counties_normalized_county_name_idx
  on geo_counties (normalized_county_name);

-- Optional overrides when raw source strings do not normalize to the canonical county key.
create table if not exists geo_county_aliases (
  id bigserial primary key,
  county_id bigint not null references geo_counties (id) on delete restrict,
  source_system text not null,
  raw_name text not null,
  normalized_raw_name text
    generated always as (normalize_geo_name(raw_name)) stored,
  created_at timestamptz not null default now(),
  constraint geo_county_aliases_source_normalized_unique unique (source_system, normalized_raw_name)
);

alter table geo_county_aliases
  drop constraint if exists geo_county_aliases_raw_name_not_blank;

alter table geo_county_aliases
  add constraint geo_county_aliases_raw_name_not_blank check (trim(raw_name) <> '');

create index if not exists geo_county_aliases_normalized_raw_name_idx
  on geo_county_aliases (normalized_raw_name);

create index if not exists geo_county_aliases_source_norm_idx
  on geo_county_aliases (source_system, normalized_raw_name);

create index if not exists raw_vr_county_idx on raw_vr (county);

create or replace view raw_vr_county_mapped as
with base as (
  select
    rv.*,
    normalize_geo_name(rv.county::text) as county_normalized
  from raw_vr rv
)
select
  b.*,
  coalesce(a.county_id, gc.id) as mapped_county_id
from base b
left join geo_county_aliases a
  on a.source_system = 'raw_vr'
  and a.normalized_raw_name = b.county_normalized
left join geo_counties gc
  on gc.normalized_county_name = b.county_normalized;

create or replace view diagnostics_vr_unmatched_counties as
select
  m.county::text as raw_county_value,
  m.county_normalized,
  count(*)::bigint as row_count
from raw_vr_county_mapped m
where m.mapped_county_id is null
  and m.county is not null
  and trim(m.county::text) <> ''
group by m.county::text, m.county_normalized;

create or replace view diagnostics_vr_mapping_coverage as
select
  count(*)::bigint as total_rows,
  count(*) filter (where mapped_county_id is not null)::bigint as mapped_rows,
  count(*) filter (where mapped_county_id is null)::bigint as unmapped_rows,
  round(
    100.0 * count(*) filter (where mapped_county_id is not null)::numeric
      / nullif(count(*)::numeric, 0),
    2
  ) as pct_mapped
from raw_vr_county_mapped;

create or replace view diagnostics_vr_county_coverage as
with vr as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as registered_voters
  from raw_vr_county_mapped m
  where m.mapped_county_id is not null
  group by m.mapped_county_id
)
select
  gc.id as county_id,
  gc.county_name,
  (vr.county_id is not null) as has_vr_data,
  coalesce(vr.registered_voters, 0::bigint) as registered_voters
from geo_counties gc
left join vr on vr.county_id = gc.id
where gc.state_fips = '05';

drop view if exists analytics_precinct_performance cascade;
drop view if exists analytics_precinct_turnout_gap cascade;

create or replace view analytics_county_registration_gap as
with vr as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as registered_voters
  from raw_vr_county_mapped m
  where m.mapped_county_id is not null
  group by m.mapped_county_id
),
acs_latest as (
  select distinct on (county_id)
    county_id,
    voting_age_population
  from census_county_acs
  order by county_id, source_year desc
)
select
  gc.state_fips,
  gc.county_fips,
  gc.county_name,
  coalesce(vr.registered_voters, 0::bigint) as registered_voters,
  al.voting_age_population,
  case
    when al.voting_age_population is not null and al.voting_age_population > 0
    then round(
      (coalesce(vr.registered_voters, 0)::numeric / al.voting_age_population::numeric) * 100,
      2
    )
  end as registration_penetration_rate
from geo_counties gc
join acs_latest al on al.county_id = gc.id
left join vr on vr.county_id = gc.id
where gc.state_fips = '05';

create or replace view analytics_county_economic_stress as
with acs as (
  select distinct on (county_id)
    county_id,
    median_household_income,
    poverty_population
  from census_county_acs
  order by county_id, source_year desc
),
laus as (
  select county_id, unemployment_rate
  from bls_laus_county_latest
),
qcew as (
  select county_id, average_weekly_wage
  from bls_qcew_county_latest
)
select
  gc.county_name,
  acs.median_household_income,
  acs.poverty_population,
  laus.unemployment_rate,
  qcew.average_weekly_wage
from geo_counties gc
left join acs on acs.county_id = gc.id
left join laus on laus.county_id = gc.id
left join qcew on qcew.county_id = gc.id
where gc.state_fips = '05';

create or replace view analytics_county_power_profile as
with vr as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as registered_voters
  from raw_vr_county_mapped m
  where m.mapped_county_id is not null
  group by m.mapped_county_id
),
acs as (
  select distinct on (county_id)
    county_id,
    voting_age_population,
    median_household_income,
    poverty_population,
    white_population,
    black_population,
    hispanic_population,
    asian_population
  from census_county_acs
  order by county_id, source_year desc
)
select
  gc.state_fips,
  gc.county_fips,
  gc.county_name,
  coalesce(vr.registered_voters, 0::bigint) as registered_voters,
  acs.voting_age_population,
  case
    when acs.voting_age_population is not null and acs.voting_age_population > 0
    then round(
      (coalesce(vr.registered_voters, 0)::numeric / acs.voting_age_population::numeric) * 100,
      2
    )
  end as registration_penetration_rate,
  acs.median_household_income,
  acs.poverty_population,
  acs.white_population,
  acs.black_population,
  acs.hispanic_population,
  acs.asian_population
from geo_counties gc
left join vr on vr.county_id = gc.id
left join acs on acs.county_id = gc.id
where gc.state_fips = '05';

create or replace view analytics_county_election_totals as
select
  gc.id as county_id,
  gc.county_name,
  e.election_year,
  r.id as race_id,
  r.office_name,
  sum(case when lower(coalesce(cr.party, '')) like '%dem%' then cr.votes else 0 end)::bigint
    as democratic_votes,
  sum(case when lower(coalesce(cr.party, '')) like '%rep%' then cr.votes else 0 end)::bigint
    as republican_votes,
  sum(cr.votes)::bigint as total_votes,
  case
    when sum(cr.votes) > 0
    then round(
      (sum(case when lower(coalesce(cr.party, '')) like '%dem%' then cr.votes else 0 end)::numeric
        / sum(cr.votes)::numeric) * 100,
      2
    )
  end as dem_vote_share,
  case
    when sum(cr.votes) > 0
    then round(
      (sum(case when lower(coalesce(cr.party, '')) like '%rep%' then cr.votes else 0 end)::numeric
        / sum(cr.votes)::numeric) * 100,
      2
    )
  end as rep_vote_share
from county_election_results cr
join races r on r.id = cr.race_id
join elections e on e.id = r.election_id
join geo_counties gc on gc.id = cr.county_id
group by gc.id, gc.county_name, e.election_year, r.id, r.office_name;

create or replace view analytics_city_election_totals as
select
  gct.id as city_id,
  gct.city_name,
  gct.city_key,
  gc.county_name as primary_county_name,
  e.election_year,
  r.id as race_id,
  r.office_name,
  sum(case when lower(coalesce(cr.party, '')) like '%dem%' then cr.votes else 0 end)::bigint
    as democratic_votes,
  sum(case when lower(coalesce(cr.party, '')) like '%rep%' then cr.votes else 0 end)::bigint
    as republican_votes,
  sum(cr.votes)::bigint as total_votes,
  case
    when sum(cr.votes) > 0
    then round(
      (sum(case when lower(coalesce(cr.party, '')) like '%dem%' then cr.votes else 0 end)::numeric
        / sum(cr.votes)::numeric) * 100,
      2
    )
  end as dem_vote_share,
  case
    when sum(cr.votes) > 0
    then round(
      (sum(case when lower(coalesce(cr.party, '')) like '%rep%' then cr.votes else 0 end)::numeric
        / sum(cr.votes)::numeric) * 100,
      2
    )
  end as rep_vote_share
from city_election_results cr
join races r on r.id = cr.race_id
join elections e on e.id = r.election_id
join geo_cities gct on gct.id = cr.city_id
left join geo_counties gc on gc.id = gct.county_id
group by gct.id, gct.city_name, gct.city_key, gc.county_name, e.election_year, r.id, r.office_name;

create or replace view analytics_county_election_candidate_votes as
select
  cr.id as county_election_result_id,
  gc.county_name,
  e.election_year,
  r.office_name,
  cr.candidate_name,
  cr.party,
  cr.votes,
  sum(cr.votes) over (partition by cr.race_id, cr.county_id) as total_votes_in_race,
  case
    when sum(cr.votes) over (partition by cr.race_id, cr.county_id) > 0
    then round(
      (cr.votes::numeric
        / sum(cr.votes) over (partition by cr.race_id, cr.county_id)::numeric) * 100,
      2
    )
  end as vote_share
from county_election_results cr
join races r on r.id = cr.race_id
join elections e on e.id = r.election_id
join geo_counties gc on gc.id = cr.county_id;

create or replace view analytics_city_election_candidate_votes as
select
  cr.id as city_election_result_id,
  gct.city_name,
  gct.city_key,
  e.election_year,
  r.office_name,
  cr.candidate_name,
  cr.party,
  cr.votes,
  sum(cr.votes) over (partition by cr.race_id, cr.city_id) as total_votes_in_race,
  case
    when sum(cr.votes) over (partition by cr.race_id, cr.city_id) > 0
    then round(
      (cr.votes::numeric
        / sum(cr.votes) over (partition by cr.race_id, cr.city_id)::numeric) * 100,
      2
    )
  end as vote_share
from city_election_results cr
join races r on r.id = cr.race_id
join elections e on e.id = r.election_id
join geo_cities gct on gct.id = cr.city_id;

create or replace view analytics_county_election_turnout as
select
  ct.id as county_election_turnout_id,
  gc.county_name,
  e.election_year,
  ct.registered_voters,
  ct.ballots_cast,
  case
    when ct.registered_voters is not null and ct.registered_voters > 0
    then round((ct.ballots_cast::numeric / ct.registered_voters::numeric) * 100, 2)
  end as turnout_rate
from county_election_turnout ct
join elections e on e.id = ct.election_id
join geo_counties gc on gc.id = ct.county_id;

create or replace view analytics_city_election_turnout as
select
  ct.id as city_election_turnout_id,
  gct.city_name,
  gct.city_key,
  e.election_year,
  ct.registered_voters,
  ct.ballots_cast,
  case
    when ct.registered_voters is not null and ct.registered_voters > 0
    then round((ct.ballots_cast::numeric / ct.registered_voters::numeric) * 100, 2)
  end as turnout_rate
from city_election_turnout ct
join elections e on e.id = ct.election_id
join geo_cities gct on gct.id = ct.city_id;

-- Precinct analytics deferred; empty shells keep API/query typings stable until Phase 3.
create or replace view analytics_precinct_turnout_gap as
select
  cast(null as text) as precinct_key,
  cast(null as text) as county_name,
  cast(null as int) as election_year,
  cast(null as bigint) as registered_voters,
  cast(null as bigint) as ballots_cast,
  cast(null as numeric) as turnout_rate
where false;

create or replace view analytics_precinct_performance as
select
  cast(null as text) as precinct_key,
  cast(null as text) as county_name,
  cast(null as int) as election_year,
  cast(null as text) as office_name,
  cast(null as bigint) as democratic_votes,
  cast(null as bigint) as republican_votes,
  cast(null as bigint) as total_votes,
  cast(null as numeric) as dem_vote_share,
  cast(null as numeric) as rep_vote_share
where false;
