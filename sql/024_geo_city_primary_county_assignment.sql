-- County ↔ Census Place assignment layer.
-- Motivation:
-- - Census "place" geography can span counties.
-- - Our county pages need a stable, deterministic way to attach each geo_city (place_fips) to a primary county.
-- Strategy:
-- - Compute VR dominance: for each geo_city (matched by city_key), pick the county with the most VR unique voters.
-- - Allow optional manual overrides via a small table.
--
-- Depends on: geo_cities, geo_counties, raw_vr, raw_vr_county_mapped, normalize_geo_name().
-- Idempotent: safe to re-run.

create table if not exists public.geo_city_primary_county_overrides (
  id bigserial primary key,
  geo_city_id bigint not null references public.geo_cities (id) on delete cascade,
  county_id bigint not null references public.geo_counties (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geo_city_primary_county_overrides_unique unique (geo_city_id)
);

drop trigger if exists geo_city_primary_county_overrides_set_updated_at
  on public.geo_city_primary_county_overrides;
create trigger geo_city_primary_county_overrides_set_updated_at
  before update on public.geo_city_primary_county_overrides
  for each row execute procedure set_updated_at();

drop view if exists public.geo_city_primary_county_v cascade;

create view public.geo_city_primary_county_v
with (security_invoker = true)
as
with
-- VR counts by (county, city_key) using the same normalization we use elsewhere.
vr_city_counts as (
  select
    m.mapped_county_id as county_id,
    public.normalize_geo_name(rv.res_city) as city_key,
    count(
      distinct coalesce(nullif(trim(rv.voter_id), ''), nullif(trim(rv.key_registrant), ''))
    )::bigint as vr_unique_voters
  from public.raw_vr rv
  join public.raw_vr_county_mapped m
    on m.id = rv.id
  where m.mapped_county_id is not null
    and rv.res_city is not null
    and trim(rv.res_city) <> ''
  group by m.mapped_county_id, public.normalize_geo_name(rv.res_city)
),

-- Candidate county assignments for each geo_city.
candidates as (
  select
    gcit.id as geo_city_id,
    gcit.state_fips,
    gcit.place_fips,
    gcit.city_name,
    gcit.city_key,
    vcc.county_id,
    coalesce(vcc.vr_unique_voters, 0::bigint) as vr_unique_voters_in_county
  from public.geo_cities gcit
  left join vr_city_counts vcc
    on vcc.city_key = gcit.city_key
  where gcit.state_fips = '05'
),

ranked as (
  select
    c.*,
    sum(c.vr_unique_voters_in_county) over (partition by c.geo_city_id)::bigint as vr_unique_voters_total,
    row_number() over (
      partition by c.geo_city_id
      order by c.vr_unique_voters_in_county desc nulls last, c.county_id nulls last
    ) as rn
  from candidates c
),

dominant as (
  select
    r.geo_city_id,
    r.state_fips,
    r.place_fips,
    r.city_name,
    r.city_key,
    r.county_id as dominant_county_id,
    r.vr_unique_voters_in_county as dominant_vr_unique_voters,
    r.vr_unique_voters_total,
    case
      when r.vr_unique_voters_total > 0
        then round(100.0 * r.vr_unique_voters_in_county::numeric / r.vr_unique_voters_total::numeric, 4)
      else null
    end as dominance_share_pct
  from ranked r
  where r.rn = 1
),

overrides as (
  select
    o.geo_city_id,
    o.county_id as override_county_id,
    o.notes
  from public.geo_city_primary_county_overrides o
)

select
  d.geo_city_id,
  d.state_fips,
  d.place_fips,
  d.city_name,
  d.city_key,
  coalesce(o.override_county_id, d.dominant_county_id) as county_id,
  (o.override_county_id is not null) as is_override,
  d.dominant_vr_unique_voters,
  d.vr_unique_voters_total,
  d.dominance_share_pct,
  o.notes as override_notes
from dominant d
left join overrides o
  on o.geo_city_id = d.geo_city_id;

comment on view public.geo_city_primary_county_v is
  'Primary county assignment per Census Place (geo_cities): VR dominance by city_key across counties, with optional manual override. Use for county drilldowns when places span counties.';

