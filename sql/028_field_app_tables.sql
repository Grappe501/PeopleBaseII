/*
  Field App — initial data model
  - idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS
  - all timestamps are timestamptz
  - minimal columns to support: turf assignment → session → contact outcomes → follow-ups → notes → sync + quality flags
*/

create table if not exists public.turfs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  county_id bigint null references public.geo_counties(id) on delete set null,

  turf_name text not null,
  turf_key text null unique,
  precinct_label text null,

  door_count int null,
  contact_count int null,

  priority_score numeric null,
  is_active boolean not null default true
);

create index if not exists turfs_county_id_idx on public.turfs(county_id);
create index if not exists turfs_priority_idx on public.turfs(priority_score desc);

create table if not exists public.turf_assignments (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  turf_id bigint not null references public.turfs(id) on delete cascade,
  volunteer_id bigint not null references public.volunteers(id) on delete cascade,

  assigned_by text null,
  assigned_at timestamptz not null default now(),

  assignment_status text not null default 'assigned',

  unique(turf_id, volunteer_id)
);

create index if not exists turf_assignments_volunteer_id_idx on public.turf_assignments(volunteer_id);
create index if not exists turf_assignments_turf_id_idx on public.turf_assignments(turf_id);

create table if not exists public.canvass_sessions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  volunteer_id bigint not null references public.volunteers(id) on delete cascade,
  turf_id bigint null references public.turfs(id) on delete set null,

  started_at timestamptz not null default now(),
  ended_at timestamptz null,

  session_status text not null default 'active',

  checkin_location_text text null,
  checkout_summary text null
);

create index if not exists canvass_sessions_volunteer_id_idx on public.canvass_sessions(volunteer_id);
create index if not exists canvass_sessions_turf_id_idx on public.canvass_sessions(turf_id);
create index if not exists canvass_sessions_started_at_idx on public.canvass_sessions(started_at desc);

create table if not exists public.canvass_contacts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  turf_id bigint null references public.turfs(id) on delete set null,
  county_id bigint null references public.geo_counties(id) on delete set null,

  contact_key text null unique,

  full_name text null,
  address1 text not null,
  address2 text null,
  city text null,
  state text null default 'AR',
  zip text null,

  phone text null,
  email text null,

  preferred_language text null,
  household_id text null,

  do_not_contact boolean not null default false
);

create index if not exists canvass_contacts_turf_id_idx on public.canvass_contacts(turf_id);
create index if not exists canvass_contacts_county_id_idx on public.canvass_contacts(county_id);
create index if not exists canvass_contacts_dnc_idx on public.canvass_contacts(do_not_contact);

create table if not exists public.canvass_responses (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  session_id bigint not null references public.canvass_sessions(id) on delete cascade,
  contact_id bigint not null references public.canvass_contacts(id) on delete cascade,
  volunteer_id bigint not null references public.volunteers(id) on delete cascade,

  response_type text not null, -- not_home/contact_made/bad_address/refused/skip
  sentiment text null,         -- very_positive/positive/mixed/negative/declined/unknown
  issues jsonb null,

  wants_followup boolean not null default false,
  wants_event_invite boolean not null default false,
  wants_volunteer_info boolean not null default false,

  note text null,

  unique(session_id, contact_id)
);

create index if not exists canvass_responses_session_id_idx on public.canvass_responses(session_id);
create index if not exists canvass_responses_contact_id_idx on public.canvass_responses(contact_id);
create index if not exists canvass_responses_type_idx on public.canvass_responses(response_type);

create table if not exists public.field_followups (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  contact_id bigint not null references public.canvass_contacts(id) on delete cascade,
  created_by_volunteer_id bigint not null references public.volunteers(id) on delete cascade,

  followup_type text not null, -- call/text/email/event_invite/volunteer_followup/data_cleanup/county_lead
  priority text not null default 'medium', -- high/medium/low
  due_at timestamptz null,
  assigned_to text null,

  status text not null default 'open',
  note text null
);

create index if not exists field_followups_contact_id_idx on public.field_followups(contact_id);
create index if not exists field_followups_status_idx on public.field_followups(status);
create index if not exists field_followups_due_at_idx on public.field_followups(due_at);

create table if not exists public.field_notes (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  contact_id bigint not null references public.canvass_contacts(id) on delete cascade,
  volunteer_id bigint not null references public.volunteers(id) on delete cascade,

  note text not null,
  tags jsonb null
);

create index if not exists field_notes_contact_id_idx on public.field_notes(contact_id);
create index if not exists field_notes_volunteer_id_idx on public.field_notes(volunteer_id);

create table if not exists public.field_sync_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  volunteer_id bigint not null references public.volunteers(id) on delete cascade,

  device_id text null,
  status text not null, -- synced/pending/failed
  pending_count int null,
  error text null
);

create index if not exists field_sync_events_volunteer_id_idx on public.field_sync_events(volunteer_id);
create index if not exists field_sync_events_created_at_idx on public.field_sync_events(created_at desc);

create table if not exists public.field_data_quality_flags (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  contact_id bigint null references public.canvass_contacts(id) on delete set null,
  session_id bigint null references public.canvass_sessions(id) on delete set null,
  volunteer_id bigint null references public.volunteers(id) on delete set null,

  flag_type text not null, -- suspicious_pattern/missing_fields/bad_address_repeat/low_notes
  severity text not null default 'warn',
  details jsonb null
);

create index if not exists field_dq_flags_contact_id_idx on public.field_data_quality_flags(contact_id);
create index if not exists field_dq_flags_session_id_idx on public.field_data_quality_flags(session_id);
create index if not exists field_dq_flags_volunteer_id_idx on public.field_data_quality_flags(volunteer_id);

