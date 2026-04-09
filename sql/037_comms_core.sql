/*
  Communications OS v1 — templates, approval queue, provider webhook inbox.
  Links to compliance_message_log on successful send (stub provider until SendGrid/Twilio).
  Idempotent.
*/

create table if not exists public.comms_templates (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  template_key text not null,
  name text not null,
  channel text not null default 'email', -- email | sms
  subject text null,
  body text not null,
  is_active boolean not null default true,

  constraint comms_templates_key_unique unique (template_key),
  constraint comms_templates_channel_chk check (channel in ('email', 'sms'))
);

create index if not exists comms_templates_channel_idx on public.comms_templates(channel);
create index if not exists comms_templates_active_idx on public.comms_templates(is_active);

drop trigger if exists comms_templates_set_updated_at on public.comms_templates;
create trigger comms_templates_set_updated_at
  before update on public.comms_templates
  for each row execute procedure set_updated_at();

create table if not exists public.comms_queue (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,
  channel text not null, -- email | sms
  template_key text null,
  subject text null,
  body text not null,

  status text not null default 'draft',
  -- draft → pending_approval → approved → queued → sent | failed
  -- rejected | blocked_compliance

  submitted_at timestamptz null,
  approved_by text null,
  approved_at timestamptz null,
  rejected_by text null,
  rejected_at timestamptz null,
  rejection_reason text null,

  -- No FK here so migration 037 can run before 036_compliance_core.sql; add FK in 038 if desired.
  compliance_message_log_id bigint null,
  block_reason text null,

  created_by text null,

  constraint comms_queue_channel_chk check (channel in ('email', 'sms')),
  constraint comms_queue_status_chk check (
    status in (
      'draft',
      'pending_approval',
      'approved',
      'rejected',
      'queued',
      'sent',
      'failed',
      'blocked_compliance'
    )
  )
);

create index if not exists comms_queue_person_id_idx on public.comms_queue(person_id);
create index if not exists comms_queue_status_idx on public.comms_queue(status);
create index if not exists comms_queue_created_at_idx on public.comms_queue(created_at desc);

drop trigger if exists comms_queue_set_updated_at on public.comms_queue;
create trigger comms_queue_set_updated_at
  before update on public.comms_queue
  for each row execute procedure set_updated_at();

-- Inbound provider events (webhook placeholders; no signature verification in v1).
create table if not exists public.comms_webhook_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  provider text not null, -- sendgrid | twilio
  event_type text null,
  payload jsonb not null default '{}'::jsonb,

  processed_at timestamptz null,
  error text null
);

create index if not exists comms_webhook_events_provider_idx on public.comms_webhook_events(provider);
create index if not exists comms_webhook_events_created_at_idx on public.comms_webhook_events(created_at desc);

-- Optional trace from compliance log back to queue (only when compliance_message_log exists).
do $$
begin
  if to_regclass('public.compliance_message_log') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'compliance_message_log'
        and column_name = 'comms_queue_id'
    ) then
      alter table public.compliance_message_log
        add column comms_queue_id bigint null references public.comms_queue(id) on delete set null;
    end if;
    execute 'create index if not exists compliance_message_log_comms_queue_id_idx on public.compliance_message_log(comms_queue_id)';
  end if;
end $$;

-- Seed templates (safe re-run)
insert into public.comms_templates (template_key, name, channel, subject, body, is_active)
values
  (
    'welcome_volunteer_v1',
    'Welcome volunteer',
    'email',
    'Thanks for stepping up',
    'Hi {{first_name}},\n\nThank you for volunteering. We will follow up with next steps.\n\n— Campaign',
    true
  ),
  (
    'event_reminder_sms_v1',
    'Event reminder (SMS)',
    'sms',
    null,
    'Reminder: {{event_title}} at {{when}}. Reply STOP to opt out.',
    true
  )
on conflict (template_key) do update set
  name = excluded.name,
  channel = excluded.channel,
  subject = excluded.subject,
  body = excluded.body,
  is_active = excluded.is_active,
  updated_at = now();

comment on table public.comms_templates is 'Reusable message bodies; merge fields are app-layer for v1.';
comment on table public.comms_queue is 'Outbound queue with approval; send writes compliance_message_log.';
comment on table public.comms_webhook_events is 'Raw webhook inbox for SendGrid/Twilio; process async later.';
