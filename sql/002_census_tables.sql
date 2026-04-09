-- Census ACS storage (county + optional tract)
-- Requires 001_geography_reference.sql (geo_counties, set_updated_at).

create table if not exists census_county_acs (
  id bigserial primary key,
  county_id bigint not null references geo_counties (id) on delete restrict,
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
  constraint census_county_acs_county_year_unique unique (county_id, source_year)
);

create index if not exists census_county_acs_source_year_idx on census_county_acs (source_year);

drop trigger if exists census_county_acs_set_updated_at on census_county_acs;
create trigger census_county_acs_set_updated_at
  before update on census_county_acs
  for each row execute procedure set_updated_at();

create table if not exists census_tract_acs (
  id bigserial primary key,
  geoid text not null,
  county_id bigint not null references geo_counties (id) on delete restrict,
  tract_code text not null,
  source_year int not null,
  total_population bigint,
  median_household_income numeric,
  poverty_population bigint,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint census_tract_acs_geoid_year_unique unique (geoid, source_year)
);

create index if not exists census_tract_acs_county_id_idx on census_tract_acs (county_id);

drop trigger if exists census_tract_acs_set_updated_at on census_tract_acs;
create trigger census_tract_acs_set_updated_at
  before update on census_tract_acs
  for each row execute procedure set_updated_at();
