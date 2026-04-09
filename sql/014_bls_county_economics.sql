-- Migrate legacy bls_* tables (year/month/quarter columns) to canonical LAUS + QCEW shape.
-- Safe to run after 003 on fresh DBs (no-ops when columns already match).

drop view if exists analytics_county_economic_stress cascade;

-- ---- bls_laus_county ----
alter table bls_laus_county drop constraint if exists bls_laus_county_unique;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_laus_county' and column_name = 'year'
  ) then
    execute 'alter table bls_laus_county rename column year to source_year';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_laus_county' and column_name = 'month'
  ) then
    execute 'alter table bls_laus_county rename column month to source_month';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_laus_county' and column_name = 'employed'
  ) then
    execute 'alter table bls_laus_county rename column employed to employment';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_laus_county' and column_name = 'unemployed'
  ) then
    execute 'alter table bls_laus_county rename column unemployed to unemployment';
  end if;
end $$;

alter table bls_laus_county add column if not exists series_ids jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_laus_county' and column_name = 'period'
  ) then
    execute $ddl$
      alter table bls_laus_county add column period text generated always as (
        source_year::text || '-' || lpad(source_month::text, 2, '0')
      ) stored
    $ddl$;
  end if;
end $$;

drop index if exists bls_laus_county_year_month_idx;
create index if not exists bls_laus_county_source_year_month_idx
  on bls_laus_county (source_year desc, source_month desc);

do $$
begin
  begin
    alter table bls_laus_county add constraint bls_laus_county_unique
      unique (county_id, source_year, source_month);
  exception
    when duplicate_object then null;
  end;
end $$;

-- ---- bls_qcew_county ----
alter table bls_qcew_county drop constraint if exists bls_qcew_county_unique;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'year'
  ) then
    execute 'alter table bls_qcew_county rename column year to source_year';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'quarter'
  )
     and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'qtr'
  ) then
    execute 'alter table bls_qcew_county add column qtr text';
    execute $u$
      update bls_qcew_county
      set qtr = case
        when quarter between 1 and 4 then quarter::text
        else 'A'
      end
      where qtr is null
    $u$;
    execute 'alter table bls_qcew_county drop column quarter';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'total_wages'
  )
     and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'total_annual_wages'
  ) then
    execute 'alter table bls_qcew_county rename column total_wages to total_annual_wages';
  end if;
end $$;

alter table bls_qcew_county add column if not exists ownership_code text;
alter table bls_qcew_county add column if not exists industry_code text;
alter table bls_qcew_county add column if not exists source_reference text;

update bls_qcew_county
set ownership_code = coalesce(ownership_code, '0'),
    industry_code = coalesce(industry_code, '10')
where ownership_code is null or industry_code is null;

alter table bls_qcew_county alter column ownership_code set default '0';
alter table bls_qcew_county alter column industry_code set default '10';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'ownership_code'
  ) and exists (select 1 from bls_qcew_county where ownership_code is null limit 1) then
    update bls_qcew_county set ownership_code = '0' where ownership_code is null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'industry_code'
  ) and exists (select 1 from bls_qcew_county where industry_code is null limit 1) then
    update bls_qcew_county set industry_code = '10' where industry_code is null;
  end if;
end $$;

alter table bls_qcew_county alter column ownership_code set not null;
alter table bls_qcew_county alter column industry_code set not null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bls_qcew_county' and column_name = 'is_annual_avg'
  ) then
    execute $ddl$
      alter table bls_qcew_county add column is_annual_avg boolean generated always as (qtr = 'A') stored
    $ddl$;
  end if;
end $$;

do $$
begin
  begin
    alter table bls_qcew_county add constraint bls_qcew_county_qtr_check
      check (qtr in ('1', '2', '3', '4', 'A'));
  exception
    when duplicate_object then null;
  end;
end $$;

drop index if exists bls_qcew_county_year_q_idx;
create index if not exists bls_qcew_county_source_year_q_idx
  on bls_qcew_county (source_year desc, qtr desc);

do $$
begin
  begin
    alter table bls_qcew_county add constraint bls_qcew_county_unique
      unique (county_id, source_year, qtr, ownership_code, industry_code);
  exception
    when duplicate_object then null;
  end;
end $$;

-- Latest usable row per county (analysis-facing)
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

-- Repair analytics view that referenced legacy column names
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
