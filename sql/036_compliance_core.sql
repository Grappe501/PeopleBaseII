/*
  Compliance core — OS v3 foundation

  Purpose:
  - Centralize outreach eligibility (consent + opt-out + suppressions) across channels.
  - Provide auditable logs for outbound messaging and sensitive reads/exports.

  Principles:
  - Keep PII minimal; store hashes where possible for suppression lookups.
  - Never rely on user-editable JWT claims for authorization (app handles auth separately).
  - Idempotent: safe to re-run.
*/

create extension if not exists pgcrypto;

-- Enumerations (implemented as CHECK constraints to keep migrations idempotent).

create table if not exists public.compliance_consent_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  person_id uuid null references public.people(id) on delete set null,

  -- When person_id is unknown (e.g., raw inbound opt-out), capture normalized value + hash.
  contact_type text not null, -- email | phone
  contact_value text null,
  contact_value_sha256 text null,

  channel text not null, -- email | sms | phone | mail
  consent_status text not null, -- granted | denied | unknown
  source text not null default 'manual', -- manual | import | webhook | system
  evidence text null,
  occurred_at timestamptz not null default now(),

  constraint compliance_consent_events_contact_type_chk check (contact_type in ('email', 'phone')),
  constraint compliance_consent_events_channel_chk check (channel in ('email', 'sms', 'phone', 'mail')),
  constraint compliance_consent_events_status_chk check (consent_status in ('granted', 'denied', 'unknown'))
);

create index if not exists compliance_consent_events_person_id_idx
  on public.compliance_consent_events(person_id);
create index if not exists compliance_consent_events_contact_hash_idx
  on public.compliance_consent_events(contact_type, contact_value_sha256);
create index if not exists compliance_consent_events_occurred_at_idx
  on public.compliance_consent_events(occurred_at desc);

create table if not exists public.compliance_suppressions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid null references public.people(id) on delete set null,

  contact_type text not null, -- email | phone
  contact_value text null,
  contact_value_sha256 text null,

  channel text not null, -- email | sms | phone | mail
  suppression_reason text not null, -- opt_out | bounces | complaint | do_not_call | do_not_text | do_not_email | legal_hold | internal
  suppression_source text not null default 'manual', -- manual | import | webhook | system
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  note text null,

  constraint compliance_suppressions_contact_type_chk check (contact_type in ('email', 'phone')),
  constraint compliance_suppressions_channel_chk check (channel in ('email', 'sms', 'phone', 'mail'))
);

create index if not exists compliance_suppressions_person_id_idx
  on public.compliance_suppressions(person_id);
create index if not exists compliance_suppressions_contact_hash_idx
  on public.compliance_suppressions(contact_type, contact_value_sha256);
create index if not exists compliance_suppressions_channel_idx
  on public.compliance_suppressions(channel);
create index if not exists compliance_suppressions_active_idx
  on public.compliance_suppressions(channel, starts_at, ends_at);

drop trigger if exists compliance_suppressions_set_updated_at on public.compliance_suppressions;
create trigger compliance_suppressions_set_updated_at
  before update on public.compliance_suppressions
  for each row execute procedure set_updated_at();

-- Outbound message log (for compliance + reporting; does not require provider integration).
create table if not exists public.compliance_message_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  person_id uuid null references public.people(id) on delete set null,
  channel text not null, -- email | sms
  to_value text null,
  to_value_sha256 text null,

  provider text null, -- sendgrid | twilio | manual | system
  provider_message_id text null,
  template_key text null,
  subject text null,
  body_preview text null,

  status text not null default 'queued', -- queued | sent | delivered | bounced | failed | complained | opted_out
  error text null,

  sent_at timestamptz null,
  delivered_at timestamptz null,

  constraint compliance_message_log_channel_chk check (channel in ('email', 'sms'))
);

create index if not exists compliance_message_log_person_id_idx
  on public.compliance_message_log(person_id);
create index if not exists compliance_message_log_channel_status_idx
  on public.compliance_message_log(channel, status);
create index if not exists compliance_message_log_created_at_idx
  on public.compliance_message_log(created_at desc);

-- Sensitive access log (exports, bulk searches, downloads, etc.)
create table if not exists public.compliance_access_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  actor text null, -- user id/email when auth exists; null in dev
  action text not null, -- export | search | view | download | update
  object_type text not null, -- people | county | reengagement | workflow | events | volunteers | raw_vr | other
  object_id text null,

  reason text null,
  ip text null,
  user_agent text null,

  metadata jsonb null
);

create index if not exists compliance_access_log_created_at_idx
  on public.compliance_access_log(created_at desc);
create index if not exists compliance_access_log_object_idx
  on public.compliance_access_log(object_type, object_id);

-- Convenience view: latest effective suppression by person/channel (null-safe).
create or replace view public.compliance_person_channel_status_v
with (security_invoker = true)
as
with latest_consent as (
  select distinct on (person_id, channel)
    person_id,
    channel,
    consent_status,
    occurred_at
  from public.compliance_consent_events
  where person_id is not null
  order by person_id, channel, occurred_at desc, id desc
),
active_suppression as (
  select distinct on (person_id, channel)
    person_id,
    channel,
    suppression_reason,
    starts_at,
    ends_at
  from public.compliance_suppressions
  where person_id is not null
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  order by person_id, channel, starts_at desc, id desc
)
select
  p.id as person_id,
  p.display_name,
  c.channel,
  coalesce(c.consent_status, 'unknown') as consent_status,
  s.suppression_reason,
  (s.suppression_reason is not null) as is_suppressed
from public.people p
cross join (values ('email'::text), ('sms'::text), ('phone'::text), ('mail'::text)) as ch(channel)
left join latest_consent c on c.person_id = p.id and c.channel = ch.channel
left join active_suppression s on s.person_id = p.id and s.channel = ch.channel;

comment on view public.compliance_person_channel_status_v is
  'Per-person, per-channel effective compliance status: latest consent + any active suppression.';

