-- One-time migration: county normalization + alias table + mapping views.
-- Run on databases that already had legacy analytics (lower(trim) county key) before the refactor.
-- Includes normalize_geo_name() so this file is self-contained if sql/001_geography_reference.sql was not re-applied.
--
-- This migration is intentionally narrow: it alters geo_counties / geo_county_aliases / raw_vr and only
-- recreates views that depend on the normalization layer (plus fixing analytics_city_election_turnout).
-- Full analytics definitions for greenfield installs: sql/005_analytics_views.sql (keep mapping + diagnostics in sync).

create or replace function normalize_geo_name(value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    regexp_replace(
      trim(lower(coalesce(value, ''))),
      '(^|[^a-z])saint([^a-z]|$)',
      '\1st\2',
      'gi'
    ),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

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
