-- Events approval workflow (first-class command-center requirement).
-- Adds event_status + timestamps and an append-only approval log.
-- Updates events_rollup_v to only emit approved+published events upstream.
--
-- Depends on: sql/025_events_calendar.sql (events + events_rollup_v baseline).
-- Idempotent: safe to re-run.

alter table public.events
  add column if not exists event_status text not null default 'draft';

alter table public.events
  add column if not exists submitted_at timestamptz;

alter table public.events
  add column if not exists approved_at timestamptz;

alter table public.events
  add column if not exists approved_by text;

alter table public.events
  add column if not exists rejected_at timestamptz;

alter table public.events
  add column if not exists rejected_by text;

alter table public.events
  add column if not exists rejection_reason text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'events'
      and constraint_name = 'events_status_chk'
  ) then
    alter table public.events
      add constraint events_status_chk check (
        event_status in ('draft', 'in_review', 'approved', 'rejected', 'archived')
      );
  end if;
end $$;

create index if not exists events_event_status_idx on public.events (event_status);

create table if not exists public.event_approvals (
  id bigserial primary key,
  event_id bigint not null references public.events (id) on delete cascade,
  action text not null, -- 'submit' | 'approve' | 'reject' | 'archive' | 'unarchive'
  actor text,
  reason text,
  created_at timestamptz not null default now(),
  constraint event_approvals_action_chk check (action in ('submit', 'approve', 'reject', 'archive', 'unarchive'))
);

create index if not exists event_approvals_event_id_idx on public.event_approvals (event_id);
create index if not exists event_approvals_created_at_idx on public.event_approvals (created_at desc);

-- Replace rollup view to emit only approved events (and still allow is_published to hide).
drop view if exists public.events_rollup_v;

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
    coalesce(
      e.county_id,
      case
        when e.geo_city_id is not null then (select p.county_id from place_to_county p where p.geo_city_id = e.geo_city_id)
        else null
      end
    ) as derived_county_id
  from public.events e
  where e.is_published is true
    and e.event_status = 'approved'
),
expanded as (
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
  'Events rollup: emits only approved+published events into upstream calendars (precinct→place→county→state).';

