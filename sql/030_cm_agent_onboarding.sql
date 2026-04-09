/*
  CM Agent onboarding / campaign operating agreement
  - Stores campaign philosophy, constraints, priorities, style, availability
  - Designed to be updated over time (latest row is canonical)
*/

create table if not exists public.cm_agent_onboarding (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- who this applies to (optional)
  created_by text null,

  -- operating agreement
  campaign_philosophy text null,
  focuses text null,
  priorities_json jsonb null,
  style_guide text null,
  decision_rules text null,

  -- availability + cadence
  weekly_hours_available numeric null,
  preferred_checkin_cadence text null,

  -- important constraints (safety + legality + campaign policy)
  constraints text null,

  -- agent routing preferences (how CM agent should delegate to other agents)
  agent_routing_notes text null
);

create index if not exists cm_agent_onboarding_updated_at_idx
  on public.cm_agent_onboarding(updated_at desc);

