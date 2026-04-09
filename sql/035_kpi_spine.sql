/*
  KPI spine — Phase 1 (campaign + county rollups)

  Goal:
  - Provide a stable, fast read layer for dashboards (CM Hub, county pages, department views).
  - Keep it idempotent and tolerant of partially-built modules (null-safe joins).

  Notes:
  - We purposely avoid assumptions about comms + fundraising until those modules exist.
  - Uses time windows relative to now(); safe for "force-dynamic" dashboards.
*/

create or replace view public.kpi_campaign_snapshot_v
with (security_invoker = true)
as
with
vol as (
  select
    count(*)::bigint as total_volunteers,
    count(*) filter (where v.volunteer_status = 'active')::bigint as active_volunteers
  from public.volunteers v
),
events_7d as (
  select
    count(*)::bigint as events_this_week
  from public.events e
  where e.is_published is true
    and e.starts_at >= date_trunc('week', now())
    and e.starts_at < date_trunc('week', now()) + interval '7 days'
),
field_7d as (
  select
    count(*)::bigint as field_contacts_7d
  from public.canvass_responses r
  where r.created_at >= now() - interval '7 days'
    and r.response_type in ('contact_made', 'refused', 'not_home', 'bad_address')
),
wf as (
  select
    count(*) filter (where t.status <> 'complete')::bigint as open_workflow_tasks,
    count(*) filter (where t.status = 'blocked')::bigint as blocked_workflow_tasks
  from public.workflow_tasks t
)
select
  (select total_volunteers from vol) as total_volunteers,
  (select active_volunteers from vol) as active_volunteers,
  (select events_this_week from events_7d) as events_this_week,
  (select field_contacts_7d from field_7d) as field_contacts_7d,
  (select open_workflow_tasks from wf) as open_workflow_tasks,
  (select blocked_workflow_tasks from wf) as blocked_workflow_tasks,
  now() as computed_at;

comment on view public.kpi_campaign_snapshot_v is
  'Campaign-wide KPI snapshot for CM Hub. Derived from volunteers, events, canvass_responses, workflow_tasks.';

create or replace view public.kpi_county_snapshot_v
with (security_invoker = true)
as
with
active_volunteers as (
  select
    v.county_id,
    count(*)::bigint as active_volunteers
  from public.volunteers v
  where v.volunteer_status = 'active'
    and v.county_id is not null
  group by 1
),
wf_open as (
  select
    t.county_id,
    count(*)::bigint as open_workflow_tasks
  from public.workflow_tasks t
  where t.status <> 'complete'
    and t.county_id is not null
  group by 1
),
events_next_14d as (
  select
    e.county_id,
    count(*)::bigint as events_next_14d
  from public.events e
  where e.is_published is true
    and e.county_id is not null
    and e.starts_at >= now()
    and e.starts_at < now() + interval '14 days'
  group by 1
),
field_30d as (
  select
    c.county_id,
    count(*)::bigint as field_contacts_30d
  from public.canvass_responses r
  join public.canvass_contacts c on c.id = r.contact_id
  where r.created_at >= now() - interval '30 days'
    and c.county_id is not null
    and r.response_type in ('contact_made', 'refused', 'not_home', 'bad_address')
  group by 1
)
select
  gc.id as county_id,
  gc.county_name,
  coalesce(av.active_volunteers, 0) as active_volunteers,
  coalesce(wf.open_workflow_tasks, 0) as open_workflow_tasks,
  coalesce(ev.events_next_14d, 0) as events_next_14d,
  coalesce(f.field_contacts_30d, 0) as field_contacts_30d
from public.geo_counties gc
left join active_volunteers av on av.county_id = gc.id
left join wf_open wf on wf.county_id = gc.id
left join events_next_14d ev on ev.county_id = gc.id
left join field_30d f on f.county_id = gc.id;

comment on view public.kpi_county_snapshot_v is
  'County KPI rollup: volunteers + workflows + events + field. Used for county dashboards and drilldowns.';

