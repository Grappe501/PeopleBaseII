/*
  Unified People system — core tables (canonical person + identifiers + contact methods + addresses + source links)
  This is the backbone that lets voters/volunteers/donors/etc. resolve to one person without destroying source data.
*/

create extension if not exists pgcrypto;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  display_name text null,
  first_name text null,
  middle_name text null,
  last_name text null,
  suffix text null,
  preferred_name text null,

  date_of_birth date null,
  birth_year int null,

  gender text null,
  language_preference text null,

  status text not null default 'active', -- active/inactive/archived/deceased/moved
  source_confidence_score numeric(5,2) null,

  primary_county_id bigint null references public.geo_counties(id) on delete set null,
  primary_precinct_label text null,
  primary_city text null,
  primary_state text null,
  primary_zip5 text null,

  is_voter boolean not null default false,
  is_volunteer boolean not null default false,
  is_donor boolean not null default false,
  is_supporter boolean not null default false
);

create index if not exists people_primary_county_id_idx on public.people(primary_county_id);
create index if not exists people_status_idx on public.people(status);

create table if not exists public.person_identifiers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,

  identifier_type text not null, -- voter_id, key_registrant, email, phone, goodchange_donor_id, etc.
  identifier_value text not null,
  identifier_normalized text null,

  source_system text not null, -- raw_vr/raw_vh/goodchange/website/manual/etc.

  is_primary boolean not null default false,
  is_verified boolean not null default false,

  unique(identifier_type, identifier_value)
);

create index if not exists person_identifiers_person_id_idx on public.person_identifiers(person_id);
create index if not exists person_identifiers_type_idx on public.person_identifiers(identifier_type);

create table if not exists public.person_contact_methods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,

  contact_type text not null, -- email/mobile_phone/home_phone/discord/etc.
  contact_value text not null,
  contact_normalized text null,

  is_primary boolean not null default false,
  is_verified boolean not null default false,

  can_email boolean not null default false,
  can_text boolean not null default false,
  can_call boolean not null default false,

  consent_status text not null default 'unknown', -- opted_in/opted_out/unknown/suppressed
  consent_source text null,
  consent_updated_at timestamptz null
);

create index if not exists person_contact_methods_person_id_idx on public.person_contact_methods(person_id);
create index if not exists person_contact_methods_type_idx on public.person_contact_methods(contact_type);

create table if not exists public.person_addresses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,

  address_type text not null default 'home',
  house_number text null,
  street_name text null,
  unit text null,
  city text null,
  state text null,
  zip5 text null,
  zip4 text null,

  county_id bigint null references public.geo_counties(id) on delete set null,
  precinct_label text null,

  latitude numeric null,
  longitude numeric null,

  is_primary boolean not null default false,
  is_current boolean not null default true,

  source_system text null
);

create index if not exists person_addresses_person_id_idx on public.person_addresses(person_id);
create index if not exists person_addresses_county_id_idx on public.person_addresses(county_id);

create table if not exists public.person_source_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  person_id uuid not null references public.people(id) on delete cascade,

  source_system text not null,
  source_table text not null,
  source_record_key text not null,

  match_type text not null, -- exact/deterministic/probable/manual
  match_score numeric(5,2) null,
  linked_by text not null default 'system',
  linked_at timestamptz not null default now(),

  unique(source_system, source_table, source_record_key)
);

create index if not exists person_source_links_person_id_idx on public.person_source_links(person_id);
create index if not exists person_source_links_source_idx on public.person_source_links(source_system, source_table);

