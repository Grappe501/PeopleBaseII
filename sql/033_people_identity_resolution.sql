/*
  Unified People system — identity resolution and audit
*/

create extension if not exists pgcrypto;

create table if not exists public.person_match_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  left_source_system text not null,
  left_source_table text not null,
  left_source_record_key text not null,

  right_source_system text not null,
  right_source_table text not null,
  right_source_record_key text not null,

  suggested_person_id uuid null references public.people(id) on delete set null,

  match_score numeric(5,2) not null,
  match_reasons jsonb not null,
  match_status text not null default 'pending', -- pending/accepted/rejected/auto_linked/auto_merged

  reviewed_by text null,
  reviewed_at timestamptz null
);

create index if not exists person_match_candidates_status_idx on public.person_match_candidates(match_status);
create index if not exists person_match_candidates_score_idx on public.person_match_candidates(match_score desc);

create table if not exists public.person_merge_log (
  id uuid primary key default gen_random_uuid(),
  merged_at timestamptz not null default now(),

  surviving_person_id uuid not null references public.people(id) on delete cascade,
  merged_person_id uuid not null,

  merge_reason text null,
  merge_strategy text null, -- auto/manual/admin/agent-assisted
  merge_details jsonb null,

  merged_by text null
);

create index if not exists person_merge_log_surviving_idx on public.person_merge_log(surviving_person_id);

/*
  Views — v1 reporting surfaces (placeholders but functional)
*/

create or replace view public.people_master_v as
with email_primary as (
  select distinct on (person_id)
    person_id,
    contact_value as email
  from public.person_contact_methods
  where contact_type = 'email'
  order by person_id, is_primary desc, is_verified desc, updated_at desc, created_at desc
),
phone_primary as (
  select distinct on (person_id)
    person_id,
    contact_value as phone
  from public.person_contact_methods
  where contact_type in ('mobile_phone', 'home_phone', 'work_phone', 'phone')
  order by person_id, is_primary desc, is_verified desc, updated_at desc, created_at desc
),
stats as (
  select
    person_id,
    count(*)::bigint as activity_count,
    max(occurred_at) as last_activity_at
  from public.person_activity
  group by 1
)
select
  p.id as person_id,
  coalesce(p.display_name, concat_ws(' ', p.first_name, p.last_name)) as display_name,
  p.first_name,
  p.last_name,
  p.primary_county_id,
  gc.county_name,
  p.primary_precinct_label,
  p.is_voter,
  p.is_volunteer,
  p.is_donor,
  p.is_supporter,
  e.email as email_primary,
  ph.phone as phone_primary,
  coalesce(s.activity_count, 0) as activity_count,
  s.last_activity_at
from public.people p
left join public.geo_counties gc on gc.id = p.primary_county_id
left join email_primary e on e.person_id = p.id
left join phone_primary ph on ph.person_id = p.id
left join stats s on s.person_id = p.id;

create or replace view public.people_match_review_v as
select
  id,
  left_source_system,
  left_source_table,
  left_source_record_key,
  right_source_system,
  right_source_table,
  right_source_record_key,
  suggested_person_id,
  match_score,
  match_reasons,
  match_status,
  reviewed_by,
  reviewed_at,
  created_at
from public.person_match_candidates
where match_status = 'pending'
order by match_score desc, created_at desc;

