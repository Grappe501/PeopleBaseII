/*
  Messaging orchestration v1 — journeys, steps, audiences, enrollments, memory, metrics, compliance logs.
  Idempotent. Requires: public.people, public.comms_queue, public.comms_templates (037+).

  Orchestrator creates queue rows (email/sms) via existing pipeline; non-email/sms channels are stubbed.
*/

-- ---------------------------------------------------------------------------
-- Objectives: why messaging exists
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_objectives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  objective_key text not null,
  name text not null,
  description text null,

  constraint messaging_objectives_key_unique unique (objective_key)
);

create index if not exists messaging_objectives_name_idx on public.messaging_objectives(name);

drop trigger if exists messaging_objectives_set_updated_at on public.messaging_objectives;
create trigger messaging_objectives_set_updated_at
  before update on public.messaging_objectives
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Audiences: segment definitions (JSON contract; SQL refs optional)
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_audiences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  query_definition jsonb not null default '{}'::jsonb,
  is_dynamic boolean not null default true,
  estimated_size integer null,
  last_evaluated_at timestamptz null
);

create index if not exists messaging_audiences_name_idx on public.messaging_audiences(name);

drop trigger if exists messaging_audiences_set_updated_at on public.messaging_audiences;
create trigger messaging_audiences_set_updated_at
  before update on public.messaging_audiences
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Journeys: multi-step sequences
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_journeys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  objective_id uuid null references public.messaging_objectives(id) on delete set null,
  audience_id uuid null references public.messaging_audiences(id) on delete set null,

  journey_name text not null,
  journey_type text not null default 'other',
  status text not null default 'draft',

  start_date timestamptz null,
  end_date timestamptz null,
  created_by text null,

  constraint messaging_journeys_type_chk check (
    journey_type in ('turnout', 'volunteer', 'donor', 'event', 'persuasion', 'other')
  ),
  constraint messaging_journeys_status_chk check (
    status in ('draft', 'active', 'paused', 'complete')
  )
);

create index if not exists messaging_journeys_status_idx on public.messaging_journeys(status);
create index if not exists messaging_journeys_objective_idx on public.messaging_journeys(objective_id);

drop trigger if exists messaging_journeys_set_updated_at on public.messaging_journeys;
create trigger messaging_journeys_set_updated_at
  before update on public.messaging_journeys
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Steps: ordered actions (send, wait, condition, branch)
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_journey_steps (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  journey_id uuid not null references public.messaging_journeys(id) on delete cascade,
  step_order integer not null,
  step_type text not null,

  channel text null,
  template_key text null,

  delay_after_previous_value integer null default 0,
  delay_after_previous_unit text null,

  condition_logic jsonb null,
  audience_filter_override jsonb null,

  requires_approval boolean not null default true,

  constraint messaging_journey_steps_order_unique unique (journey_id, step_order),
  constraint messaging_journey_steps_type_chk check (
    step_type in ('send', 'wait', 'condition', 'branch')
  ),
  constraint messaging_journey_steps_channel_chk check (
    channel is null
    or channel in ('email', 'sms', 'p2p_sms', 'social', 'phone_followup')
  ),
  constraint messaging_journey_steps_delay_unit_chk check (
    delay_after_previous_unit is null
    or delay_after_previous_unit in ('minute', 'hour', 'day')
  )
);

create index if not exists messaging_journey_steps_journey_idx on public.messaging_journey_steps(journey_id);

drop trigger if exists messaging_journey_steps_set_updated_at on public.messaging_journey_steps;
create trigger messaging_journey_steps_set_updated_at
  before update on public.messaging_journey_steps
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Enrollments: per-person state in a journey
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_journey_enrollments (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,
  journey_id uuid not null references public.messaging_journeys(id) on delete cascade,

  current_step_order integer not null default 1,
  status text not null default 'active',

  last_step_at timestamptz null,
  next_step_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  constraint messaging_journey_enrollments_status_chk check (
    status in ('active', 'completed', 'exited', 'suppressed')
  )
);

create unique index if not exists messaging_journey_enrollments_one_active_per_person
  on public.messaging_journey_enrollments (person_id, journey_id)
  where status = 'active';

create index if not exists messaging_journey_enrollments_next_idx
  on public.messaging_journey_enrollments (next_step_at asc)
  where status = 'active';

create index if not exists messaging_journey_enrollments_journey_idx
  on public.messaging_journey_enrollments (journey_id);

drop trigger if exists messaging_journey_enrollments_set_updated_at on public.messaging_journey_enrollments;
create trigger messaging_journey_enrollments_set_updated_at
  before update on public.messaging_journey_enrollments
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Person communication memory (orchestration + engagement)
-- ---------------------------------------------------------------------------
create table if not exists public.person_communication_history (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,
  journey_id uuid null references public.messaging_journeys(id) on delete set null,
  journey_step_id bigint null references public.messaging_journey_steps(id) on delete set null,

  channel text not null,
  direction text not null,
  event_type text not null,

  comms_queue_id bigint null references public.comms_queue(id) on delete set null,
  compliance_message_log_id bigint null,

  template_key text null,
  engagement jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  constraint person_communication_history_direction_chk check (
    direction in ('outbound', 'inbound')
  ),
  constraint person_communication_history_channel_chk check (
    channel in ('email', 'sms', 'p2p_sms', 'social', 'phone_followup', 'system')
  )
);

create index if not exists person_communication_history_person_idx
  on public.person_communication_history (person_id, created_at desc);
create index if not exists person_communication_history_journey_idx
  on public.person_communication_history (journey_id) where journey_id is not null;

do $$
begin
  if to_regclass('public.compliance_message_log') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'person_communication_history_compliance_fk'
    ) then
      alter table public.person_communication_history
        add constraint person_communication_history_compliance_fk
        foreign key (compliance_message_log_id)
        references public.compliance_message_log(id) on delete set null;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Compliance decisions per journey step
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_journey_compliance_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,
  journey_id uuid not null references public.messaging_journeys(id) on delete cascade,
  journey_step_id bigint null references public.messaging_journey_steps(id) on delete set null,
  enrollment_id bigint null references public.messaging_journey_enrollments(id) on delete set null,

  action text not null,
  channel text null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,

  constraint messaging_journey_compliance_logs_action_chk check (
    action in ('passed', 'blocked', 'skipped', 'rerouted', 'suppressed_exit')
  )
);

create index if not exists messaging_journey_compliance_logs_journey_idx
  on public.messaging_journey_compliance_logs (journey_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Daily metrics (rollup; orchestrator increments)
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_journey_metrics_daily (
  journey_id uuid not null references public.messaging_journeys(id) on delete cascade,
  metric_date date not null,

  enrollments_new integer not null default 0,
  active integer not null default 0,
  completed integer not null default 0,
  exited integer not null default 0,
  suppressed integer not null default 0,
  sends integer not null default 0,

  primary key (journey_id, metric_date)
);

create table if not exists public.messaging_journey_step_metrics_daily (
  journey_id uuid not null references public.messaging_journeys(id) on delete cascade,
  journey_step_id bigint not null references public.messaging_journey_steps(id) on delete cascade,
  metric_date date not null,

  attempts integer not null default 0,
  sent integer not null default 0,
  blocked integer not null default 0,
  opens integer not null default 0,
  clicks integer not null default 0,

  primary key (journey_id, journey_step_id, metric_date)
);

-- ---------------------------------------------------------------------------
-- Link queue to orchestration (nullable)
-- ---------------------------------------------------------------------------
alter table public.comms_queue
  add column if not exists messaging_journey_id uuid null references public.messaging_journeys(id) on delete set null,
  add column if not exists messaging_journey_step_id bigint null references public.messaging_journey_steps(id) on delete set null;

create index if not exists comms_queue_journey_idx on public.comms_queue (messaging_journey_id)
  where messaging_journey_id is not null;

comment on table public.messaging_objectives is 'Campaign messaging goals (turnout, volunteer, etc.).';
comment on table public.messaging_journeys is 'Multi-step messaging journeys; replaces one-off blasts.';
comment on table public.messaging_journey_steps is 'Sequence engine: send/wait/condition/branch.';
comment on table public.messaging_audiences is 'Audience definitions; query_definition is app-interpreted JSON.';
comment on table public.messaging_journey_enrollments is 'Per-person journey state and scheduling.';
comment on table public.person_communication_history is 'Unified message memory for orchestration and engagement.';
comment on table public.messaging_journey_compliance_logs is 'Per-step compliance outcomes for audit and reroute.';
comment on table public.messaging_journey_metrics_daily is 'Rolling daily journey KPIs.';
comment on table public.messaging_journey_step_metrics_daily is 'Per-step daily performance.';
