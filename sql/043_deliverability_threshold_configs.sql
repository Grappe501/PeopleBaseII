/*
  Deliverability v0 — tunable warning/critical thresholds (no hardcoded limits in app).
  Server-side queries read this table; workers and incident detection can follow.
*/

create table if not exists public.deliverability_threshold_configs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  channel text not null,
  threshold_key text not null,
  warning_value numeric(14, 6) null,
  critical_value numeric(14, 6) null,
  active boolean not null default true,

  constraint deliverability_threshold_configs_channel_chk check (
    channel in ('email', 'sms', 'global')
  ),
  constraint deliverability_threshold_configs_unique unique (channel, threshold_key)
);

create index if not exists deliverability_threshold_configs_active_idx
  on public.deliverability_threshold_configs (channel, threshold_key)
  where active = true;

drop trigger if exists deliverability_threshold_configs_set_updated_at
  on public.deliverability_threshold_configs;
create trigger deliverability_threshold_configs_set_updated_at
  before update on public.deliverability_threshold_configs
  for each row execute procedure set_updated_at();

comment on table public.deliverability_threshold_configs is
  'Operational thresholds for bounce/complaint/opt-out/sender health; tune without deploys.';

insert into public.deliverability_threshold_configs (channel, threshold_key, warning_value, critical_value, active)
values
  ('email', 'bounce_rate', 0.02, 0.05, true),
  ('email', 'complaint_rate', 0.001, 0.003, true),
  ('email', 'unsubscribe_rate', 0.005, 0.015, true),
  ('sms', 'opt_out_rate', 0.01, 0.03, true),
  ('sms', 'undelivered_rate', 0.05, 0.12, true),
  ('global', 'sender_health_score_min', 70, 50, true)
on conflict (channel, threshold_key) do nothing;
