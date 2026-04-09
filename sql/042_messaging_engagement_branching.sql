/*
  Event-based journey branching: engagement events + enrollment status waiting_branch.
  Requires 041_messaging_orchestration.sql.
*/

-- ---------------------------------------------------------------------------
-- Engagement events (webhooks + system) — powers condition/branch steps
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_engagement_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,
  journey_id uuid null references public.messaging_journeys(id) on delete set null,
  enrollment_id bigint null references public.messaging_journey_enrollments(id) on delete set null,
  journey_step_id bigint null references public.messaging_journey_steps(id) on delete set null,

  compliance_message_log_id bigint null,
  comms_queue_id bigint null references public.comms_queue(id) on delete set null,

  channel text not null default 'system',
  event_type text not null,
  source text not null default 'webhook',
  external_id text null,
  payload jsonb not null default '{}'::jsonb,

  constraint messaging_engagement_events_channel_chk check (
    channel in ('email', 'sms', 'system')
  )
);

do $$
begin
  if to_regclass('public.compliance_message_log') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'messaging_engagement_events_compliance_fk'
    ) then
      alter table public.messaging_engagement_events
        add constraint messaging_engagement_events_compliance_fk
        foreign key (compliance_message_log_id)
        references public.compliance_message_log(id) on delete set null;
    end if;
  end if;
end $$;

create index if not exists messaging_engagement_events_person_created_idx
  on public.messaging_engagement_events (person_id, created_at desc);
create index if not exists messaging_engagement_events_log_idx
  on public.messaging_engagement_events (compliance_message_log_id)
  where compliance_message_log_id is not null;
create index if not exists messaging_engagement_events_journey_idx
  on public.messaging_engagement_events (journey_id, created_at desc)
  where journey_id is not null;

comment on table public.messaging_engagement_events is
  'Inbound engagement signals (opens, clicks, delivery, replies) for orchestration branching.';

-- ---------------------------------------------------------------------------
-- Enrollment: allow waiting_branch + extend uniqueness to active | waiting_branch
-- ---------------------------------------------------------------------------
alter table public.messaging_journey_enrollments
  drop constraint if exists messaging_journey_enrollments_status_chk;

alter table public.messaging_journey_enrollments
  add constraint messaging_journey_enrollments_status_chk check (
    status in ('active', 'completed', 'exited', 'suppressed', 'waiting_branch')
  );

drop index if exists messaging_journey_enrollments_one_active_per_person;

create unique index if not exists messaging_journey_enrollments_one_active_per_person
  on public.messaging_journey_enrollments (person_id, journey_id)
  where status in ('active', 'waiting_branch');

drop index if exists messaging_journey_enrollments_next_idx;

create index if not exists messaging_journey_enrollments_next_idx
  on public.messaging_journey_enrollments (next_step_at asc)
  where status in ('active', 'waiting_branch');
