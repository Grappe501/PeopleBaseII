/*
  Volunteer OS — initial tables (minimal foundation)

  Notes:
  - Designed to be safe/idempotent for repeated migration runs.
  - Keeps PII fields explicit and minimal at this stage.
  - Uses geo_counties as the first-class assignment anchor.
*/

create table if not exists public.volunteers (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- identity/contact
  first_name text null,
  last_name text null,
  email text null,
  phone text null,

  -- organizing assignment (first version: county-level)
  county_id bigint null references public.geo_counties(id) on delete set null,

  -- lifecycle
  volunteer_status text not null default 'new',
  onboarding_status text not null default 'not_started',

  notes text null
);

create index if not exists volunteers_county_id_idx on public.volunteers(county_id);
create index if not exists volunteers_status_idx on public.volunteers(volunteer_status);
create unique index if not exists volunteers_email_unique_idx
  on public.volunteers(lower(email))
  where email is not null and btrim(email) <> '';

create unique index if not exists volunteers_phone_unique_idx
  on public.volunteers(phone)
  where phone is not null and btrim(phone) <> '';

create table if not exists public.volunteer_roles (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  role_key text not null unique,
  role_name text not null,
  role_description text null,

  is_active boolean not null default true
);

create table if not exists public.volunteer_role_assignments (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  volunteer_id bigint not null references public.volunteers(id) on delete cascade,
  role_id bigint not null references public.volunteer_roles(id) on delete cascade,

  assigned_by text null,
  assigned_at timestamptz not null default now(),

  unique(volunteer_id, role_id)
);

create index if not exists volunteer_role_assignments_volunteer_id_idx
  on public.volunteer_role_assignments(volunteer_id);
create index if not exists volunteer_role_assignments_role_id_idx
  on public.volunteer_role_assignments(role_id);

create table if not exists public.volunteer_tasks (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  description text null,

  -- optional assignment anchors
  volunteer_id bigint null references public.volunteers(id) on delete set null,
  county_id bigint null references public.geo_counties(id) on delete set null,

  task_status text not null default 'open',
  due_at timestamptz null,

  created_by text null
);

create index if not exists volunteer_tasks_volunteer_id_idx on public.volunteer_tasks(volunteer_id);
create index if not exists volunteer_tasks_county_id_idx on public.volunteer_tasks(county_id);
create index if not exists volunteer_tasks_status_idx on public.volunteer_tasks(task_status);

create table if not exists public.volunteer_task_completions (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  task_id bigint not null references public.volunteer_tasks(id) on delete cascade,
  volunteer_id bigint not null references public.volunteers(id) on delete cascade,

  completed_at timestamptz not null default now(),
  completion_note text null,

  unique(task_id, volunteer_id)
);

create index if not exists volunteer_task_completions_volunteer_id_idx
  on public.volunteer_task_completions(volunteer_id);
create index if not exists volunteer_task_completions_task_id_idx
  on public.volunteer_task_completions(task_id);

