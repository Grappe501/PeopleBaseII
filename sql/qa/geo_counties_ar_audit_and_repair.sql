-- Arkansas geo_counties: audit, repair (idempotent reseed), validation
-- Run in Supabase SQL editor or psql against DATABASE_URL.
-- Repair uses the same INSERT ... ON CONFLICT as sql/001_geography_reference.sql (no new columns).

-- ---------------------------------------------------------------------------
-- 1) LIVE: count + spot malformed FIPS (whitespace / wrong length)
-- ---------------------------------------------------------------------------
select count(*)::int as ar_county_rows
from geo_counties
where state_fips = '05';

select
  id,
  state_fips,
  county_fips,
  length(trim(county_fips::text)) as fips_trim_len,
  county_name,
  county_key
from geo_counties
where state_fips = '05'
  and (
    trim(county_fips::text) <> county_fips::text
    or length(trim(county_fips::text)) <> 3
    or county_key <> (state_fips || county_fips)
  );

-- ---------------------------------------------------------------------------
-- 2) OPTIONAL: normalize padding on existing rows (no schema change)
--    Only if the select above shows issues. char(3) values should still be 001..075.
-- ---------------------------------------------------------------------------
-- update geo_counties
-- set county_fips = lpad(trim(county_fips::text), 3, '0')::char(3),
--     county_key = state_fips || lpad(trim(county_fips::text), 3, '0'),
--     updated_at = now()
-- where state_fips = '05';

-- ---------------------------------------------------------------------------
-- 3) FULL RESEED (safe / idempotent): same as sql/001 — upserts all 75 AR counties
-- ---------------------------------------------------------------------------
insert into geo_counties (state_fips, county_fips, county_name, county_key) values
  ('05', '001', 'Arkansas', '05001'),
  ('05', '002', 'Ashley', '05002'),
  ('05', '003', 'Baxter', '05003'),
  ('05', '004', 'Benton', '05004'),
  ('05', '005', 'Boone', '05005'),
  ('05', '006', 'Bradley', '05006'),
  ('05', '007', 'Calhoun', '05007'),
  ('05', '008', 'Carroll', '05008'),
  ('05', '009', 'Chicot', '05009'),
  ('05', '010', 'Clark', '05010'),
  ('05', '011', 'Clay', '05011'),
  ('05', '012', 'Cleburne', '05012'),
  ('05', '013', 'Cleveland', '05013'),
  ('05', '014', 'Columbia', '05014'),
  ('05', '015', 'Conway', '05015'),
  ('05', '016', 'Craighead', '05016'),
  ('05', '017', 'Crawford', '05017'),
  ('05', '018', 'Crittenden', '05018'),
  ('05', '019', 'Cross', '05019'),
  ('05', '020', 'Dallas', '05020'),
  ('05', '021', 'Desha', '05021'),
  ('05', '022', 'Drew', '05022'),
  ('05', '023', 'Faulkner', '05023'),
  ('05', '024', 'Franklin', '05024'),
  ('05', '025', 'Fulton', '05025'),
  ('05', '026', 'Garland', '05026'),
  ('05', '027', 'Grant', '05027'),
  ('05', '028', 'Greene', '05028'),
  ('05', '029', 'Hempstead', '05029'),
  ('05', '030', 'Hot Spring', '05030'),
  ('05', '031', 'Howard', '05031'),
  ('05', '032', 'Independence', '05032'),
  ('05', '033', 'Izard', '05033'),
  ('05', '034', 'Jackson', '05034'),
  ('05', '035', 'Jefferson', '05035'),
  ('05', '036', 'Johnson', '05036'),
  ('05', '037', 'Lafayette', '05037'),
  ('05', '038', 'Lawrence', '05038'),
  ('05', '039', 'Lee', '05039'),
  ('05', '040', 'Lincoln', '05040'),
  ('05', '041', 'Little River', '05041'),
  ('05', '042', 'Logan', '05042'),
  ('05', '043', 'Lonoke', '05043'),
  ('05', '044', 'Madison', '05044'),
  ('05', '045', 'Marion', '05045'),
  ('05', '046', 'Miller', '05046'),
  ('05', '047', 'Mississippi', '05047'),
  ('05', '048', 'Monroe', '05048'),
  ('05', '049', 'Montgomery', '05049'),
  ('05', '050', 'Nevada', '05050'),
  ('05', '051', 'Newton', '05051'),
  ('05', '052', 'Ouachita', '05052'),
  ('05', '053', 'Perry', '05053'),
  ('05', '054', 'Phillips', '05054'),
  ('05', '055', 'Pike', '05055'),
  ('05', '056', 'Poinsett', '05056'),
  ('05', '057', 'Polk', '05057'),
  ('05', '058', 'Pope', '05058'),
  ('05', '059', 'Prairie', '05059'),
  ('05', '060', 'Pulaski', '05060'),
  ('05', '061', 'Randolph', '05061'),
  ('05', '062', 'St. Francis', '05062'),
  ('05', '063', 'Saline', '05063'),
  ('05', '064', 'Scott', '05064'),
  ('05', '065', 'Searcy', '05065'),
  ('05', '066', 'Sebastian', '05066'),
  ('05', '067', 'Sevier', '05067'),
  ('05', '068', 'Sharp', '05068'),
  ('05', '069', 'Stone', '05069'),
  ('05', '070', 'Union', '05070'),
  ('05', '071', 'Van Buren', '05071'),
  ('05', '072', 'Washington', '05072'),
  ('05', '073', 'White', '05073'),
  ('05', '074', 'Woodruff', '05074'),
  ('05', '075', 'Yell', '05075')
on conflict (county_key) do update set
  county_name = excluded.county_name,
  state_fips = excluded.state_fips,
  county_fips = excluded.county_fips,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 4) VALIDATION: exactly 75 Arkansas counties
-- ---------------------------------------------------------------------------
select count(*)::int as ar_counties
from geo_counties
where state_fips = '05';
-- expect: 75

-- ---------------------------------------------------------------------------
-- 5) After npm run sync:census — ACS for CD2-relevant counties (latest year each)
-- ---------------------------------------------------------------------------
select
  g.county_name,
  g.county_key,
  c.source_year,
  c.total_population,
  c.voting_age_population,
  c.median_household_income
from geo_counties g
left join lateral (
  select *
  from census_county_acs c
  where c.county_id = g.id
  order by c.source_year desc
  limit 1
) c on true
where g.state_fips = '05'
  and g.county_name in (
    'Pulaski',
    'Saline',
    'Faulkner',
    'White',
    'Cleburne',
    'Conway',
    'Van Buren',
    'Perry'
  )
order by g.county_name;
