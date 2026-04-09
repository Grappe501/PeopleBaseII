-- Validation for public.cd2_county_master_v and county_congressional_districts (CD2).
-- Run after: sql/015_cd2_county_master_view.sql

-- ---------------------------------------------------------------------------
-- 1) Row count (expect 8 CD2 counties)
-- ---------------------------------------------------------------------------
select count(*)::int as cd2_master_row_count
from public.cd2_county_master_v;

-- ---------------------------------------------------------------------------
-- 2) Null checks on major fields (should return 0 rows if healthy)
-- ---------------------------------------------------------------------------
select
  county_name,
  county_key,
  acs_source_year,
  total_population,
  voting_age_population,
  registered_voters,
  gov_2022_general_dem_pct,
  pres_2024_general_dem_pct,
  dem_power_score
from public.cd2_county_master_v
where county_id is null
   or county_name is null
   or county_key is null
   or acs_source_year is null
   or total_population is null
   or voting_age_population is null
   or gov_2022_general_dem_pct is null
   or pres_2024_general_dem_pct is null
   or dem_power_score is null;

-- ---------------------------------------------------------------------------
-- 3) County list (CD2)
-- ---------------------------------------------------------------------------
select county_fips, county_name, county_key
from public.cd2_county_master_v
order by county_fips;

-- ---------------------------------------------------------------------------
-- 4) Trend sanity (DEM shares between 0 and 100 when present)
-- ---------------------------------------------------------------------------
select *
from public.cd2_county_master_v
where (gov_2022_general_dem_pct is not null
  and (gov_2022_general_dem_pct < 0 or gov_2022_general_dem_pct > 100))
   or (pres_2024_general_dem_pct is not null
  and (pres_2024_general_dem_pct < 0 or pres_2024_general_dem_pct > 100))
   or (sos_2026_dem_primary_pct is not null
  and (sos_2026_dem_primary_pct < 0 or sos_2026_dem_primary_pct > 100));

-- ---------------------------------------------------------------------------
-- 5) Swing sanity (bounded when all inputs present)
-- ---------------------------------------------------------------------------
select
  county_name,
  dem_swing_pct_2022_to_2024,
  dem_swing_pct_2024_to_2026,
  dem_swing_pct_2022_to_2026
from public.cd2_county_master_v
where abs(coalesce(dem_swing_pct_2022_to_2024, 0)) > 100
   or abs(coalesce(dem_swing_pct_2024_to_2026, 0)) > 100
   or abs(coalesce(dem_swing_pct_2022_to_2026, 0)) > 100;

-- ---------------------------------------------------------------------------
-- 6) Signer sanity (JSON keys present; rates non-negative when VR > 0)
-- ---------------------------------------------------------------------------
select
  county_name,
  signers_by_initiative,
  signer_rate_per_1000_registrants,
  registered_voters
from public.cd2_county_master_v
where registered_voters > 0
  and signer_rate_per_1000_registrants is not null
  and exists (
    select 1
    from jsonb_each_text(signer_rate_per_1000_registrants) kv
    where kv.value::numeric < 0
  );

-- ---------------------------------------------------------------------------
-- 7) Mapping table count (expect 8 rows for CD2)
-- ---------------------------------------------------------------------------
select count(*)::int as cd2_county_mapping_rows
from public.county_congressional_districts
where state_fips::text = '05'
  and congressional_district::numeric = 2;
