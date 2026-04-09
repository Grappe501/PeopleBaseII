-- Census ACS storage for Places (incorporated places + CDPs) within a state.
-- Mirrors census_county_acs but keyed by (state_fips, place_fips) and optionally linked to geo_cities.
-- Requires 001_geography_reference.sql (geo_cities, set_updated_at).

create table if not exists public.census_place_acs (
  id bigserial primary key,
  geo_city_id bigint references public.geo_cities (id) on delete restrict,
  state_fips char(2) not null,
  place_fips char(5) not null,
  source_year int not null,
  total_population bigint,
  voting_age_population bigint,
  white_population bigint,
  black_population bigint,
  hispanic_population bigint,
  asian_population bigint,
  median_household_income numeric,
  poverty_population bigint,
  bachelors_or_higher bigint,
  owner_occupied_housing bigint,
  renter_occupied_housing bigint,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint census_place_acs_place_year_unique unique (state_fips, place_fips, source_year)
);

create index if not exists census_place_acs_source_year_idx on public.census_place_acs (source_year);
create index if not exists census_place_acs_state_place_idx on public.census_place_acs (state_fips, place_fips);
create index if not exists census_place_acs_geo_city_id_idx on public.census_place_acs (geo_city_id);

drop trigger if exists census_place_acs_set_updated_at on public.census_place_acs;
create trigger census_place_acs_set_updated_at
  before update on public.census_place_acs
  for each row execute procedure set_updated_at();

