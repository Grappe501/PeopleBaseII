-- Arkansas geo_counties: replace alphabetical 001–075 with official US Census county FIPS.
-- The Census Data API returns state_fips + county_fips from this scheme; the previous seed
-- used sequential 001–075, which broke sync:census matching.
--
-- Two-phase update avoids unique (state_fips, county_fips) violations while re-keying.
-- Preserves geo_counties.id. Safe to re-run after the first successful apply.

-- Phase 1: move everyone to temporary 9xx keys (no overlap with Census 001–149).
-- Skip if already migrated (max county_fips > 75) so re-runs are safe.
with maxf as (
  select coalesce(max(county_fips::int), 0) as mx
  from geo_counties
  where state_fips = '05'
),
numbered as (
  select
    g.id,
    lpad((900 + row_number() over (order by county_name))::text, 3, '0') as tmp_fips
  from geo_counties g
  cross join maxf
  where g.state_fips = '05'
    and maxf.mx <= 75
)
update geo_counties g
set
  county_fips = n.tmp_fips::char(3),
  county_key = '05' || n.tmp_fips,
  updated_at = now()
from numbered n
where g.id = n.id;

-- Phase 2: set official Census county FIPS + county_key.
update geo_counties g
set
  county_fips = m.fips::char(3),
  county_key = '05' || m.fips,
  updated_at = now()
from (
  values
    ('Arkansas', '001'),
    ('Ashley', '003'),
    ('Baxter', '005'),
    ('Benton', '007'),
    ('Boone', '009'),
    ('Bradley', '011'),
    ('Calhoun', '013'),
    ('Carroll', '015'),
    ('Chicot', '017'),
    ('Clark', '019'),
    ('Clay', '021'),
    ('Cleburne', '023'),
    ('Cleveland', '025'),
    ('Columbia', '027'),
    ('Conway', '029'),
    ('Craighead', '031'),
    ('Crawford', '033'),
    ('Crittenden', '035'),
    ('Cross', '037'),
    ('Dallas', '039'),
    ('Desha', '041'),
    ('Drew', '043'),
    ('Faulkner', '045'),
    ('Franklin', '047'),
    ('Fulton', '049'),
    ('Garland', '051'),
    ('Grant', '053'),
    ('Greene', '055'),
    ('Hempstead', '057'),
    ('Hot Spring', '059'),
    ('Howard', '061'),
    ('Independence', '063'),
    ('Izard', '065'),
    ('Jackson', '067'),
    ('Jefferson', '069'),
    ('Johnson', '071'),
    ('Lafayette', '073'),
    ('Lawrence', '075'),
    ('Lee', '077'),
    ('Lincoln', '079'),
    ('Little River', '081'),
    ('Logan', '083'),
    ('Lonoke', '085'),
    ('Madison', '087'),
    ('Marion', '089'),
    ('Miller', '091'),
    ('Mississippi', '093'),
    ('Monroe', '095'),
    ('Montgomery', '097'),
    ('Nevada', '099'),
    ('Newton', '101'),
    ('Ouachita', '103'),
    ('Perry', '105'),
    ('Phillips', '107'),
    ('Pike', '109'),
    ('Poinsett', '111'),
    ('Polk', '113'),
    ('Pope', '115'),
    ('Prairie', '117'),
    ('Pulaski', '119'),
    ('Randolph', '121'),
    ('St. Francis', '123'),
    ('Saline', '125'),
    ('Scott', '127'),
    ('Searcy', '129'),
    ('Sebastian', '131'),
    ('Sevier', '133'),
    ('Sharp', '135'),
    ('Stone', '137'),
    ('Union', '139'),
    ('Van Buren', '141'),
    ('Washington', '143'),
    ('White', '145'),
    ('Woodruff', '147'),
    ('Yell', '149')
) as m(county_name, fips)
where g.state_fips = '05'
  and g.county_name = m.county_name;
