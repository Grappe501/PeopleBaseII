-- BLS county-level facts (LAUS + QCEW schema)
-- Requires 001_geography_reference.sql (geo_counties, set_updated_at).
-- Canonical join key: county_id → geo_counties.id (FIPS-derived, not county names).

create table if not exists bls_laus_county (
  id bigserial primary key,
  county_id bigint not null references geo_counties (id) on delete restrict,
  source_year int not null,
  source_month int not null,
  period text generated always as (
    source_year::text || '-' || lpad(source_month::text, 2, '0')
  ) stored,
  labor_force int,
  employment int,
  unemployment int,
  unemployment_rate numeric,
  series_ids jsonb not null default '{}'::jsonb,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bls_laus_county_unique unique (county_id, source_year, source_month)
);

create index if not exists bls_laus_county_source_year_month_idx
  on bls_laus_county (source_year desc, source_month desc);

drop trigger if exists bls_laus_county_set_updated_at on bls_laus_county;
create trigger bls_laus_county_set_updated_at
  before update on bls_laus_county
  for each row execute procedure set_updated_at();

create table if not exists bls_qcew_county (
  id bigserial primary key,
  county_id bigint not null references geo_counties (id) on delete restrict,
  source_year int not null,
  qtr text not null,
  is_annual_avg boolean generated always as (qtr = 'A') stored,
  ownership_code text not null,
  industry_code text not null,
  establishments int,
  employment int,
  total_annual_wages bigint,
  average_weekly_wage numeric,
  source_reference text,
  data_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bls_qcew_county_qtr_check check (qtr in ('1', '2', '3', '4', 'A')),
  constraint bls_qcew_county_unique unique (county_id, source_year, qtr, ownership_code, industry_code)
);

create index if not exists bls_qcew_county_source_year_q_idx
  on bls_qcew_county (source_year desc, qtr desc);

drop trigger if exists bls_qcew_county_set_updated_at on bls_qcew_county;
create trigger bls_qcew_county_set_updated_at
  before update on bls_qcew_county
  for each row execute procedure set_updated_at();

drop view if exists bls_laus_county_latest;
create or replace view bls_laus_county_latest as
select distinct on (county_id)
  *
from bls_laus_county
order by county_id, source_year desc, source_month desc;

drop view if exists bls_qcew_county_latest;
create or replace view bls_qcew_county_latest as
select distinct on (county_id)
  *
from bls_qcew_county
where ownership_code = '0'
  and industry_code = '10'
  and qtr = 'A'
order by county_id, source_year desc;
