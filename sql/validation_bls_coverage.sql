-- BLS ingestion validation (Arkansas county coverage, LAUS + QCEW).
-- Run after: migrations 003 + 014 and npm run sync:bls

-- ---------------------------------------------------------------------------
-- 1) Total Arkansas counties in geo_counties (expect 75)
-- ---------------------------------------------------------------------------
select count(*)::int as ar_counties_in_geo_counties
from geo_counties
where state_fips = '05';

-- ---------------------------------------------------------------------------
-- 2) Min / max LAUS source period (year-month)
-- ---------------------------------------------------------------------------
select
  min(source_year * 100 + source_month) as min_yyyymm,
  max(source_year * 100 + source_month) as max_yyyymm,
  min(source_year) as min_source_year,
  max(source_year) as max_source_year
from bls_laus_county;

-- ---------------------------------------------------------------------------
-- 3) Min / max QCEW source year (annual slice qtr = 'A', county totals)
-- ---------------------------------------------------------------------------
select
  min(source_year) as min_qcew_year,
  max(source_year) as max_qcew_year
from bls_qcew_county
where ownership_code = '0'
  and industry_code = '10'
  and qtr = 'A';

-- ---------------------------------------------------------------------------
-- 4) Counties missing LAUS for the latest stored month (should be 0 rows)
-- ---------------------------------------------------------------------------
with latest as (
  select max(source_year * 100 + source_month) as yymm
  from bls_laus_county
)
select
  g.county_name,
  g.county_key,
  g.state_fips || g.county_fips as area_fips
from geo_counties g
cross join latest
where g.state_fips = '05'
  and latest.yymm is not null
  and not exists (
    select 1
    from bls_laus_county l
    where l.county_id = g.id
      and l.source_year * 100 + l.source_month = latest.yymm
  )
order by g.county_fips;

-- ---------------------------------------------------------------------------
-- 5) Counties missing QCEW annual totals for the latest QCEW year (should be 0 rows)
-- ---------------------------------------------------------------------------
with latest_year as (
  select max(source_year) as y
  from bls_qcew_county
  where ownership_code = '0'
    and industry_code = '10'
    and qtr = 'A'
)
select
  g.county_name,
  g.county_key,
  g.state_fips || g.county_fips as area_fips
from geo_counties g
cross join latest_year
where g.state_fips = '05'
  and latest_year.y is not null
  and not exists (
    select 1
    from bls_qcew_county q
    where q.county_id = g.id
      and q.source_year = latest_year.y
      and q.ownership_code = '0'
      and q.industry_code = '10'
      and q.qtr = 'A'
  )
order by g.county_fips;

-- ---------------------------------------------------------------------------
-- 6) Sample: CD2 counties (Pulaski, Saline, Faulkner, White, Conway, Van Buren, Cleburne, Perry)
--    LAUS latest + QCEW latest + VR registration counts
-- ---------------------------------------------------------------------------
with cd2 as (
  select unnest(array[
    '05119', '05125', '05045', '05145', '05029', '05141', '05023', '05105'
  ]) as county_key
),
vr as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as registered_voters
  from raw_vr_county_mapped m
  where m.mapped_county_id is not null
  group by m.mapped_county_id
)
select
  g.county_name,
  g.county_key,
  l.period as laus_period,
  l.unemployment_rate,
  l.labor_force,
  l.employment,
  l.unemployment,
  q.source_year as qcew_year,
  q.establishments,
  q.employment as qcew_employment,
  q.average_weekly_wage,
  coalesce(vr.registered_voters, 0::bigint) as registered_voters
from cd2
join geo_counties g on g.county_key = cd2.county_key
left join bls_laus_county_latest l on l.county_id = g.id
left join bls_qcew_county_latest q on q.county_id = g.id
left join vr on vr.county_id = g.id
order by g.county_fips;

-- ---------------------------------------------------------------------------
-- 7) Example join: geo_counties + ACS (latest) + LAUS + QCEW + VR
-- ---------------------------------------------------------------------------
with acs as (
  select distinct on (county_id)
    county_id,
    source_year as acs_source_year,
    median_household_income,
    voting_age_population
  from census_county_acs
  order by county_id, source_year desc
),
vr as (
  select
    m.mapped_county_id as county_id,
    count(*)::bigint as registered_voters
  from raw_vr_county_mapped m
  where m.mapped_county_id is not null
  group by m.mapped_county_id
)
select
  g.id as county_id,
  g.county_key,
  g.county_name,
  acs.acs_source_year,
  acs.median_household_income,
  acs.voting_age_population,
  l.period as laus_period,
  l.unemployment_rate,
  l.labor_force,
  q.source_year as qcew_year,
  q.establishments,
  q.employment as qcew_employment,
  q.average_weekly_wage,
  coalesce(vr.registered_voters, 0::bigint) as registered_voters
from geo_counties g
left join acs on acs.county_id = g.id
left join bls_laus_county_latest l on l.county_id = g.id
left join bls_qcew_county_latest q on q.county_id = g.id
left join vr on vr.county_id = g.id
where g.state_fips = '05'
order by g.county_fips;
