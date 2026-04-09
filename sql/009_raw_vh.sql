-- public.raw_vh: voter history source (wide CSV; full row preserved in row_payload)

create table if not exists public.raw_vh (
  id bigint generated always as identity primary key,
  key_registrant text,
  voter_id text,
  county text,
  election_date text,
  election_type text,
  voting_method text,
  party_ballot text,
  row_payload jsonb not null default '{}'::jsonb,
  import_batch text not null,
  source_file_name text not null,
  imported_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists raw_vh_voter_id_idx on public.raw_vh (voter_id);
create index if not exists raw_vh_key_registrant_idx on public.raw_vh (key_registrant);
create index if not exists raw_vh_import_batch_idx on public.raw_vh (import_batch);
create index if not exists raw_vh_source_file_idx on public.raw_vh (source_file_name);
