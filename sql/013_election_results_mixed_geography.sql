-- Mixed reporting geography for election_results (precinct / county / statewide / district).
-- Apply after 012_election_results_ingestion.sql
--
-- Design: single normalized table `election_results` (no separate precinct_results table).
-- `precinct_results` is provided as a VIEW for compatibility with older docs and queries.

-- 1) New columns
alter table election_results add column if not exists geography_type text;
alter table election_results add column if not exists location_raw text;
-- Row-level reporting district (when geography is district-wide, e.g. Location = "Congressional District 04")
alter table election_results add column if not exists reporting_district_type text;
alter table election_results add column if not exists reporting_district_code text;

-- 2) Backfill from legacy result_scope + location_label
update election_results
set
  geography_type = case result_scope
    when 'state' then 'statewide'
    when 'county' then 'county'
    when 'precinct' then 'precinct'
    when 'district' then 'district'
    else 'county'
  end,
  location_raw = coalesce(nullif(trim(location_raw), ''), nullif(trim(location_label), ''), '')
where geography_type is null;

-- 3) Enforce NOT NULL before indexes and checks
alter table election_results alter column geography_type set not null;

-- 4) Relax / replace result_scope check to allow district
alter table election_results drop constraint if exists election_results_scope_chk;

do $$
begin
  alter table election_results
    add constraint election_results_scope_chk check (
      result_scope in ('state', 'county', 'precinct', 'district')
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table election_results
    add constraint election_results_geography_type_chk check (
      geography_type in ('statewide', 'county', 'precinct', 'district')
    );
exception
  when duplicate_object then null;
end $$;

-- 5) Replace natural uniqueness (use geography_type + location_raw + optional district code)
drop index if exists election_results_natural_ux;

create unique index if not exists election_results_natural_ux on election_results (
  race_id,
  coalesce(county_id, -1::bigint),
  geography_type,
  coalesce(location_raw, ''),
  coalesce(source_precinct_code, ''),
  coalesce(source_precinct_name, ''),
  coalesce(reporting_district_code, ''),
  candidate_name,
  source_file_name
);

create index if not exists election_results_geography_type_idx
  on election_results (geography_type);

-- 6) Views (precinct-only / county-only reporting rows)
create or replace view election_results_precinct_v as
select *
from election_results
where geography_type = 'precinct';

create or replace view election_results_county_v as
select *
from election_results
where geography_type = 'county';

-- Backward-compatible name used in older documentation
create or replace view precinct_results as
select *
from election_results
where geography_type = 'precinct';

comment on view precinct_results is
  'Alias for election rows with geography_type = precinct; prefer election_results or election_results_precinct_v.';
