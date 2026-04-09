-- PeopleBaseII: geography foundation (Arkansas-first, lowercase identifiers)
-- Apply before 002_census_tables.sql, 003_bls_tables.sql, 004_elections_tables.sql, 005_analytics_views.sql

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Canonical string form for geography joins: trim, lower, saint→st, strip non-alphanumeric.
create or replace function normalize_geo_name(value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    regexp_replace(
      trim(lower(coalesce(value, ''))),
      '(^|[^a-z])saint([^a-z]|$)',
      '\1st\2',
      'gi'
    ),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

create table if not exists geo_counties (
  id bigserial primary key,
  state_fips char(2) not null,
  county_fips char(3) not null,
  county_name text not null,
  county_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geo_counties_state_county_unique unique (state_fips, county_fips),
  constraint geo_counties_county_key_unique unique (county_key)
);

create index if not exists geo_counties_county_name_lower_idx
  on geo_counties (lower(trim(county_name)));

create table if not exists geo_cities (
  id bigserial primary key,
  state_fips char(2) not null,
  place_fips char(5) not null,
  city_name text not null,
  city_key text not null,
  county_id bigint references geo_counties (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geo_cities_state_place_unique unique (state_fips, place_fips),
  constraint geo_cities_city_key_unique unique (city_key)
);

create index if not exists geo_cities_county_id_idx on geo_cities (county_id);
create index if not exists geo_cities_city_name_lower_idx
  on geo_cities (lower(trim(city_name)));

drop trigger if exists geo_counties_set_updated_at on geo_counties;
create trigger geo_counties_set_updated_at
  before update on geo_counties
  for each row execute procedure set_updated_at();

drop trigger if exists geo_cities_set_updated_at on geo_cities;
create trigger geo_cities_set_updated_at
  before update on geo_cities
  for each row execute procedure set_updated_at();

insert into geo_counties (state_fips, county_fips, county_name, county_key) values
  ('05', '001', 'Arkansas', '05001'),
  ('05', '003', 'Ashley', '05003'),
  ('05', '005', 'Baxter', '05005'),
  ('05', '007', 'Benton', '05007'),
  ('05', '009', 'Boone', '05009'),
  ('05', '011', 'Bradley', '05011'),
  ('05', '013', 'Calhoun', '05013'),
  ('05', '015', 'Carroll', '05015'),
  ('05', '017', 'Chicot', '05017'),
  ('05', '019', 'Clark', '05019'),
  ('05', '021', 'Clay', '05021'),
  ('05', '023', 'Cleburne', '05023'),
  ('05', '025', 'Cleveland', '05025'),
  ('05', '027', 'Columbia', '05027'),
  ('05', '029', 'Conway', '05029'),
  ('05', '031', 'Craighead', '05031'),
  ('05', '033', 'Crawford', '05033'),
  ('05', '035', 'Crittenden', '05035'),
  ('05', '037', 'Cross', '05037'),
  ('05', '039', 'Dallas', '05039'),
  ('05', '041', 'Desha', '05041'),
  ('05', '043', 'Drew', '05043'),
  ('05', '045', 'Faulkner', '05045'),
  ('05', '047', 'Franklin', '05047'),
  ('05', '049', 'Fulton', '05049'),
  ('05', '051', 'Garland', '05051'),
  ('05', '053', 'Grant', '05053'),
  ('05', '055', 'Greene', '05055'),
  ('05', '057', 'Hempstead', '05057'),
  ('05', '059', 'Hot Spring', '05059'),
  ('05', '061', 'Howard', '05061'),
  ('05', '063', 'Independence', '05063'),
  ('05', '065', 'Izard', '05065'),
  ('05', '067', 'Jackson', '05067'),
  ('05', '069', 'Jefferson', '05069'),
  ('05', '071', 'Johnson', '05071'),
  ('05', '073', 'Lafayette', '05073'),
  ('05', '075', 'Lawrence', '05075'),
  ('05', '077', 'Lee', '05077'),
  ('05', '079', 'Lincoln', '05079'),
  ('05', '081', 'Little River', '05081'),
  ('05', '083', 'Logan', '05083'),
  ('05', '085', 'Lonoke', '05085'),
  ('05', '087', 'Madison', '05087'),
  ('05', '089', 'Marion', '05089'),
  ('05', '091', 'Miller', '05091'),
  ('05', '093', 'Mississippi', '05093'),
  ('05', '095', 'Monroe', '05095'),
  ('05', '097', 'Montgomery', '05097'),
  ('05', '099', 'Nevada', '05099'),
  ('05', '101', 'Newton', '05101'),
  ('05', '103', 'Ouachita', '05103'),
  ('05', '105', 'Perry', '05105'),
  ('05', '107', 'Phillips', '05107'),
  ('05', '109', 'Pike', '05109'),
  ('05', '111', 'Poinsett', '05111'),
  ('05', '113', 'Polk', '05113'),
  ('05', '115', 'Pope', '05115'),
  ('05', '117', 'Prairie', '05117'),
  ('05', '119', 'Pulaski', '05119'),
  ('05', '121', 'Randolph', '05121'),
  ('05', '123', 'St. Francis', '05123'),
  ('05', '125', 'Saline', '05125'),
  ('05', '127', 'Scott', '05127'),
  ('05', '129', 'Searcy', '05129'),
  ('05', '131', 'Sebastian', '05131'),
  ('05', '133', 'Sevier', '05133'),
  ('05', '135', 'Sharp', '05135'),
  ('05', '137', 'Stone', '05137'),
  ('05', '139', 'Union', '05139'),
  ('05', '141', 'Van Buren', '05141'),
  ('05', '143', 'Washington', '05143'),
  ('05', '145', 'White', '05145'),
  ('05', '147', 'Woodruff', '05147'),
  ('05', '149', 'Yell', '05149')
on conflict (county_key) do update set
  county_name = excluded.county_name,
  state_fips = excluded.state_fips,
  county_fips = excluded.county_fips,
  updated_at = now();
