-- Canonical election ingestion (raw + contests + normalized results)
-- Apply after 004_elections_tables.sql

alter table county_election_results
  add column if not exists source_file_name text;

create index if not exists county_election_results_source_file_idx
  on county_election_results (source_file_name);

create table if not exists raw_election_results (
  id bigserial primary key,
  source_file_name text not null,
  row_num int not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists election_contests (
  id bigserial primary key,
  election_id bigint not null references elections (id) on delete cascade,
  provider_contest_id text not null,
  contest_name text not null,
  race_id bigint references races (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint election_contests_election_provider_unique unique (election_id, provider_contest_id)
);

create table if not exists election_results (
  id bigserial primary key,
  race_id bigint not null references races (id) on delete cascade,
  contest_id bigint references election_contests (id) on delete set null,
  result_scope text not null,
  county_id bigint references geo_counties (id) on delete restrict,
  location_label text,
  source_precinct_code text,
  source_precinct_name text,
  candidate_name text not null,
  party text,
  votes bigint not null,
  total_votes_at_location bigint,
  vote_share_pct numeric(12, 6),
  source_file_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint election_results_scope_chk check (
    result_scope in ('state', 'county', 'precinct')
  )
);

-- Repair partial / older copies of these tables (CREATE IF NOT EXISTS skips DDL)
alter table raw_election_results add column if not exists source_file_name text;
alter table raw_election_results add column if not exists row_num int;
alter table raw_election_results add column if not exists payload jsonb;
alter table raw_election_results add column if not exists created_at timestamptz;

alter table election_contests add column if not exists election_id bigint references elections (id) on delete cascade;
alter table election_contests add column if not exists provider_contest_id text;
alter table election_contests add column if not exists contest_name text;
alter table election_contests add column if not exists race_id bigint references races (id) on delete cascade;
alter table election_contests add column if not exists created_at timestamptz;
alter table election_contests add column if not exists updated_at timestamptz;

alter table election_results add column if not exists race_id bigint references races (id) on delete cascade;
alter table election_results add column if not exists contest_id bigint references election_contests (id) on delete set null;
alter table election_results add column if not exists result_scope text;
alter table election_results add column if not exists county_id bigint references geo_counties (id) on delete restrict;
alter table election_results add column if not exists location_label text;
alter table election_results add column if not exists source_precinct_code text;
alter table election_results add column if not exists source_precinct_name text;
alter table election_results add column if not exists candidate_name text;
alter table election_results add column if not exists party text;
alter table election_results add column if not exists votes bigint;
alter table election_results add column if not exists total_votes_at_location bigint;
alter table election_results add column if not exists vote_share_pct numeric(12, 6);
alter table election_results add column if not exists source_file_name text;
alter table election_results add column if not exists created_at timestamptz;
alter table election_results add column if not exists updated_at timestamptz;

do $$
begin
  alter table election_contests
    add constraint election_contests_election_provider_unique
    unique (election_id, provider_contest_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table election_results
    add constraint election_results_scope_chk check (
      result_scope in ('state', 'county', 'precinct')
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists raw_election_results_source_idx
  on raw_election_results (source_file_name);

create index if not exists election_contests_race_id_idx on election_contests (race_id);

drop trigger if exists election_contests_set_updated_at on election_contests;
create trigger election_contests_set_updated_at
  before update on election_contests
  for each row execute procedure set_updated_at();

create index if not exists election_results_race_id_idx on election_results (race_id);
create index if not exists election_results_county_id_idx on election_results (county_id);
create index if not exists election_results_source_idx on election_results (source_file_name);

create unique index if not exists election_results_natural_ux on election_results (
  race_id,
  coalesce(county_id, -1::bigint),
  result_scope,
  coalesce(location_label, ''),
  coalesce(source_precinct_code, ''),
  coalesce(source_precinct_name, ''),
  candidate_name,
  source_file_name
);

drop trigger if exists election_results_set_updated_at on election_results;
create trigger election_results_set_updated_at
  before update on election_results
  for each row execute procedure set_updated_at();
