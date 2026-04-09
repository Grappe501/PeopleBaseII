-- Elections at county and city level (apply after 001_geography_reference.sql)
-- Requires geo_counties, geo_cities, set_updated_at from 001.

create table if not exists elections (
  id bigserial primary key,
  election_key text not null,
  election_date date,
  election_year int not null,
  election_type text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint elections_election_key_unique unique (election_key)
);

drop trigger if exists elections_set_updated_at on elections;
create trigger elections_set_updated_at
  before update on elections
  for each row execute procedure set_updated_at();

create table if not exists races (
  id bigserial primary key,
  election_id bigint not null references elections (id) on delete cascade,
  race_key text not null,
  office_name text not null,
  district_type text,
  district_code text,
  seat_name text,
  is_partisan boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint races_race_key_unique unique (race_key)
);

create index if not exists races_election_id_idx on races (election_id);

drop trigger if exists races_set_updated_at on races;
create trigger races_set_updated_at
  before update on races
  for each row execute procedure set_updated_at();

create table if not exists race_candidates (
  id bigserial primary key,
  race_id bigint not null references races (id) on delete cascade,
  candidate_name text not null,
  party text,
  ballot_order int,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists race_candidates_race_id_idx on race_candidates (race_id);

create table if not exists county_election_results (
  id bigserial primary key,
  race_id bigint not null references races (id) on delete cascade,
  county_id bigint not null references geo_counties (id) on delete restrict,
  candidate_name text not null,
  party text,
  votes bigint not null default 0,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint county_election_results_race_county_candidate_unique
    unique (race_id, county_id, candidate_name)
);

create index if not exists county_election_results_race_id_idx on county_election_results (race_id);
create index if not exists county_election_results_county_id_idx on county_election_results (county_id);

drop trigger if exists county_election_results_set_updated_at on county_election_results;
create trigger county_election_results_set_updated_at
  before update on county_election_results
  for each row execute procedure set_updated_at();

create table if not exists city_election_results (
  id bigserial primary key,
  race_id bigint not null references races (id) on delete cascade,
  city_id bigint not null references geo_cities (id) on delete restrict,
  candidate_name text not null,
  party text,
  votes bigint not null default 0,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_election_results_race_city_candidate_unique
    unique (race_id, city_id, candidate_name)
);

create index if not exists city_election_results_race_id_idx on city_election_results (race_id);
create index if not exists city_election_results_city_id_idx on city_election_results (city_id);

drop trigger if exists city_election_results_set_updated_at on city_election_results;
create trigger city_election_results_set_updated_at
  before update on city_election_results
  for each row execute procedure set_updated_at();

create table if not exists county_election_turnout (
  id bigserial primary key,
  election_id bigint not null references elections (id) on delete cascade,
  county_id bigint not null references geo_counties (id) on delete restrict,
  registered_voters bigint,
  ballots_cast bigint,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint county_election_turnout_unique unique (election_id, county_id)
);

create index if not exists county_election_turnout_election_id_idx on county_election_turnout (election_id);
create index if not exists county_election_turnout_county_id_idx on county_election_turnout (county_id);

drop trigger if exists county_election_turnout_set_updated_at on county_election_turnout;
create trigger county_election_turnout_set_updated_at
  before update on county_election_turnout
  for each row execute procedure set_updated_at();

create table if not exists city_election_turnout (
  id bigserial primary key,
  election_id bigint not null references elections (id) on delete cascade,
  city_id bigint not null references geo_cities (id) on delete restrict,
  registered_voters bigint,
  ballots_cast bigint,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_election_turnout_unique unique (election_id, city_id)
);

create index if not exists city_election_turnout_election_id_idx on city_election_turnout (election_id);
create index if not exists city_election_turnout_city_id_idx on city_election_turnout (city_id);

drop trigger if exists city_election_turnout_set_updated_at on city_election_turnout;
create trigger city_election_turnout_set_updated_at
  before update on city_election_turnout
  for each row execute procedure set_updated_at();

create table if not exists election_import_log (
  id bigserial primary key,
  source_file text not null,
  election_key text,
  rows_read bigint not null default 0,
  rows_inserted bigint not null default 0,
  rows_skipped bigint not null default 0,
  message text,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now()
);
