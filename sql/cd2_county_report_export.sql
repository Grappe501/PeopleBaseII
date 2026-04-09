-- App-facing export: CD2 county master, ranked for reporting.
-- Uses: public.cd2_county_master_v (015_cd2_county_master_view.sql)

select *
from public.cd2_county_master_v
order by
  dem_power_score desc nulls last,
  turnout_rate_pct asc nulls last,
  county_fips asc;
