-- Statewide events calendar system with upstream rollup.
-- Grain:
-- - One event can be scoped at: statewide, county, place (geo_city), precinct (label within county), or custom.
-- Rollup rule:
-- - Every event is included upstream:
--   precinct → place → county → statewide
--   place → county → statewide
--   county → statewide
--
-- Depends on: geo_counties, geo_cities, geo_city_primary_county_v (for place→county assignment).
-- Idempotent: safe to re-run.

create table if not exists public.events (
  id bigserial primary key,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text,
  location_name text,
  location_address text,
  location_notes text,

  -- Scope fields (nullable depending on scope)
  scope_level text not null, -- 'statewide' | 'county' | 'place' | 'precinct' | 'custom'
  county_id bigint references public.geo_counties (id) on delete restrict,
  geo_city_id bigint references public.geo_cities (id) on delete restrict,
  precinct_label text,

  -- Operational metadata
  is_published boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_scope_chk check (
    scope_level in ('statewide', 'county', 'place', 'precinct', 'custom')
  )
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_scope_idx on public.events (scope_level);
create index if not exists events_county_id_idx on public.events (county_id);
create index if not exists events_geo_city_id_idx on public.events (geo_city_id);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute procedure set_updated_at();

drop view if exists public.events_rollup_v cascade;

create view public.events_rollup_v
with (security_invoker = true)
as
with
place_to_county as (
  select geo_city_id, county_id
  from public.geo_city_primary_county_v
),
base as (
  select
    e.*,
    -- Derive county_id for place/precinct events if not set.
    coalesce(
      e.county_id,
      case
        when e.geo_city_id is not null then (select p.county_id from place_to_county p where p.geo_city_id = e.geo_city_id)
        else null
      end
    ) as derived_county_id
  from public.events e
  where e.is_published is true
),
expanded as (
  -- 1) Always include in statewide calendar
  select
    b.id as event_id,
    'statewide'::text as calendar_level,
    null::bigint as calendar_county_id,
    null::bigint as calendar_geo_city_id,
    null::text as calendar_precinct_label,
    b.scope_level as event_scope_level,
    b.derived_county_id as event_county_id,
    b.geo_city_id as event_geo_city_id,
    b.precinct_label as event_precinct_label,
    b.title,
    b.description,
    b.starts_at,
    b.ends_at,
    b.timezone,
    b.location_name,
    b.location_address,
    b.location_notes
  from base b

  union all

  -- 2) County calendar inclusion (for any event that can be assigned to a county)
  select
    b.id as event_id,
    'county'::text as calendar_level,
    b.derived_county_id as calendar_county_id,
    null::bigint as calendar_geo_city_id,
    null::text as calendar_precinct_label,
    b.scope_level as event_scope_level,
    b.derived_county_id as event_county_id,
    b.geo_city_id as event_geo_city_id,
    b.precinct_label as event_precinct_label,
    b.title,
    b.description,
    b.starts_at,
    b.ends_at,
    b.timezone,
    b.location_name,
    b.location_address,
    b.location_notes
  from base b
  where b.derived_county_id is not null

  union all

  -- 3) Place calendar inclusion (for place- or precinct-scoped events)
  select
    b.id as event_id,
    'place'::text as calendar_level,
    b.derived_county_id as calendar_county_id,
    b.geo_city_id as calendar_geo_city_id,
    null::text as calendar_precinct_label,
    b.scope_level as event_scope_level,
    b.derived_county_id as event_county_id,
    b.geo_city_id as event_geo_city_id,
    b.precinct_label as event_precinct_label,
    b.title,
    b.description,
    b.starts_at,
    b.ends_at,
    b.timezone,
    b.location_name,
    b.location_address,
    b.location_notes
  from base b
  where b.geo_city_id is not null

  union all

  -- 4) Precinct calendar inclusion (precinct-scoped events only)
  select
    b.id as event_id,
    'precinct'::text as calendar_level,
    b.derived_county_id as calendar_county_id,
    b.geo_city_id as calendar_geo_city_id,
    b.precinct_label as calendar_precinct_label,
    b.scope_level as event_scope_level,
    b.derived_county_id as event_county_id,
    b.geo_city_id as event_geo_city_id,
    b.precinct_label as event_precinct_label,
    b.title,
    b.description,
    b.starts_at,
    b.ends_at,
    b.timezone,
    b.location_name,
    b.location_address,
    b.location_notes
  from base b
  where b.precinct_label is not null
)
select *
from expanded;

comment on view public.events_rollup_v is
  'Events rollup: every event is emitted into upstream calendars (precinct→place→county→state). Filter by calendar_level + ids.';

