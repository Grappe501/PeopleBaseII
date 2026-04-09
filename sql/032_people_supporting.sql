/*
  Unified People system — supporting tables (tags, relationships, activity)
*/

create extension if not exists pgcrypto;

create table if not exists public.tag_definitions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  tag_key text not null unique,
  tag_label text not null,
  tag_category text null,
  is_system boolean not null default false
);

create table if not exists public.person_tags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,
  tag_id uuid not null references public.tag_definitions(id) on delete cascade,

  assigned_by text null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists person_tags_person_id_idx on public.person_tags(person_id);
create index if not exists person_tags_tag_id_idx on public.person_tags(tag_id);

create table if not exists public.person_relationships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  from_person_id uuid not null references public.people(id) on delete cascade,
  to_person_id uuid not null references public.people(id) on delete cascade,

  relationship_type text not null,
  strength_score numeric(5,2) null,
  source_system text null
);

create index if not exists person_relationships_from_idx on public.person_relationships(from_person_id);
create index if not exists person_relationships_to_idx on public.person_relationships(to_person_id);

create table if not exists public.person_activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,

  activity_type text not null,
  activity_source text null,
  activity_ref_id text null,
  county_id bigint null references public.geo_counties(id) on delete set null,
  metadata jsonb null,

  occurred_at timestamptz not null
);

create index if not exists person_activity_person_id_idx on public.person_activity(person_id);
create index if not exists person_activity_occurred_at_idx on public.person_activity(occurred_at desc);

