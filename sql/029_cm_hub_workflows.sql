/*
  CM Hub workflows (Asana-style) — minimal v1
  - tasks + dependencies
  - link tasks to counties/turfs/volunteers/events via optional foreign keys
*/

create table if not exists public.workflow_tasks (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  description text null,

  department text not null default 'campaign',
  owner text null,

  county_id bigint null references public.geo_counties(id) on delete set null,
  volunteer_id bigint null references public.volunteers(id) on delete set null,
  turf_id bigint null references public.turfs(id) on delete set null,
  -- event_id intentionally has no FK (events table may not exist in some DBs)
  event_id bigint null,

  priority text not null default 'medium', -- low/medium/high/critical
  status text not null default 'backlog',   -- backlog/ready/in_progress/blocked/complete
  due_at timestamptz null
);

create index if not exists workflow_tasks_department_idx on public.workflow_tasks(department);
create index if not exists workflow_tasks_status_idx on public.workflow_tasks(status);
create index if not exists workflow_tasks_due_at_idx on public.workflow_tasks(due_at);
create index if not exists workflow_tasks_county_id_idx on public.workflow_tasks(county_id);

create table if not exists public.workflow_task_dependencies (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  task_id bigint not null references public.workflow_tasks(id) on delete cascade,
  depends_on_task_id bigint not null references public.workflow_tasks(id) on delete cascade,

  unique(task_id, depends_on_task_id)
);

create index if not exists workflow_task_dependencies_task_id_idx
  on public.workflow_task_dependencies(task_id);
create index if not exists workflow_task_dependencies_depends_on_task_id_idx
  on public.workflow_task_dependencies(depends_on_task_id);

