/*
  KPI intelligence — scale layer (materialized snapshots + richer campaign view)

  - Expands kpi_campaign_snapshot_v with people + outbound comms (7d).
  - Materialized snapshots for fast dashboard reads (refresh on a schedule or via refresh_kpi_intel()).
  - County intelligence MV joins operational KPIs with statewide_county_master_v for ranking drilldowns.

  Requires: people (031), compliance_message_log (036). Safe to run after full chain.
*/

drop materialized view if exists public.kpi_campaign_intelligence_mv cascade;
drop materialized view if exists public.kpi_county_intelligence_mv cascade;

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
people as (
  select
    count(*)::bigint as people_total,
    count(*) filter (where p.is_volunteer)::bigint as people_volunteers
  from public.people p
),
comms as (
  select
    count(*)::bigint as comms_outbound_7d
  from public.compliance_message_log m
  where m.created_at >= now() - interval '7 days'
    and m.status in ('sent', 'delivered')
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
  (select people_total from people) as people_total,
  (select people_volunteers from people) as people_volunteers,
  (select comms_outbound_7d from comms) as comms_outbound_7d,
  (select events_this_week from events_7d) as events_this_week,
  (select field_contacts_7d from field_7d) as field_contacts_7d,
  (select open_workflow_tasks from wf) as open_workflow_tasks,
  (select blocked_workflow_tasks from wf) as blocked_workflow_tasks,
  now() as computed_at;

comment on view public.kpi_campaign_snapshot_v is
  'Campaign-wide KPI snapshot: volunteers, people graph, comms 7d, events, field, workflows.';

-- Single-row materialized cache (unique key for optional CONCURRENT refresh later).
create materialized view public.kpi_campaign_intelligence_mv as
select
  1::int as cache_key,
  v.*
from public.kpi_campaign_snapshot_v v;

create unique index if not exists kpi_campaign_intelligence_mv_cache_key_uidx
  on public.kpi_campaign_intelligence_mv(cache_key);

comment on materialized view public.kpi_campaign_intelligence_mv is
  'Materialized campaign KPI row; REFRESH via refresh_kpi_intel() or cron.';

-- County drilldown: operational metrics + statewide intelligence columns for sort/filter.
create materialized view public.kpi_county_intelligence_mv as
select
  ks.county_id,
  ks.county_name,
  gc.county_key,
  ks.active_volunteers,
  ks.open_workflow_tasks,
  ks.events_next_14d,
  ks.field_contacts_30d,
  scm.county_priority_score as intel_priority_score,
  scm.county_target_votes_at_proportional_share as target_votes_proportional,
  scm.expected_turnout_votes,
  scm.vr_unique_voters,
  scm.county_vote_share_of_state,
  scm.registrations_2025_11_to_2026_11_unique_voters as registrations_window_unique
from public.kpi_county_snapshot_v ks
join public.geo_counties gc on gc.id = ks.county_id
left join public.statewide_county_master_v scm on scm.county_id = ks.county_id;

create unique index if not exists kpi_county_intelligence_mv_county_id_uidx
  on public.kpi_county_intelligence_mv(county_id);

create index if not exists kpi_county_intelligence_mv_priority_idx
  on public.kpi_county_intelligence_mv(intel_priority_score desc nulls last);

comment on materialized view public.kpi_county_intelligence_mv is
  'Per-county KPI + statewide master scores; REFRESH via refresh_kpi_intel().';

create or replace function public.refresh_kpi_intel()
returns void
language plpgsql
security invoker
as $$
begin
  refresh materialized view public.kpi_campaign_intelligence_mv;
  refresh materialized view public.kpi_county_intelligence_mv;
end;
$$;

comment on function public.refresh_kpi_intel() is
  'Rebuild KPI materialized views after bulk loads or on a schedule (e.g. pg_cron every 5–15 min).';
