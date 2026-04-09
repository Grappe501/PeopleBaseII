-- Ad-hoc checks after election import (run in psql or Supabase SQL editor).
-- Requires migration 013_election_results_mixed_geography.sql applied.

-- 1) Row counts by reporting geography
select geography_type, count(*) as n
from election_results
group by 1
order by 1;

-- 2) Precinct rows retain source strings
select count(*) filter (where geography_type = 'precinct' and source_precinct_name is null) as precinct_missing_label
from election_results;

-- 3) location_raw populated (SOS / legacy)
select count(*) filter (where location_raw is null or trim(location_raw) = '') as missing_location_raw
from election_results;

-- 4) result_scope aligned with geography_type (should be 0 rows)
select count(*) as mismatched
from election_results
where (geography_type = 'statewide' and result_scope <> 'state')
   or (geography_type = 'county' and result_scope <> 'county')
   or (geography_type = 'precinct' and result_scope <> 'precinct')
   or (geography_type = 'district' and result_scope <> 'district');

-- 5) County-level analytics mirror (county_election_results) vs county geography rows — spot-check one race
-- select r.race_key, gc.county_name, er.votes as from_election_results, cr.votes as from_county_table
-- from election_results er
-- join races r on r.id = er.race_id
-- join geo_counties gc on gc.id = er.county_id
-- left join county_election_results cr
--   on cr.race_id = er.race_id and cr.county_id = er.county_id
--  and cr.candidate_name = er.candidate_name
-- where er.geography_type = 'county' and r.race_key = 'YOUR_RACE_KEY'
-- limit 20;

-- 6) Views match filters
select
  (select count(*) from election_results_precinct_v) as view_precinct,
  (select count(*) from election_results where geography_type = 'precinct') as table_precinct,
  (select count(*) from election_results_county_v) as view_county,
  (select count(*) from election_results where geography_type = 'county') as table_county;
