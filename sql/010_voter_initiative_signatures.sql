-- Ballot initiative signer imports: links signers to voters via voter_id and/or key_registrant only (no name/address payload).

create table if not exists public.voter_initiative_signatures (
  id bigint generated always as identity primary key,
  voter_id text,
  key_registrant text,
  initiative text not null,
  source_file_name text not null,
  import_batch text not null,
  created_at timestamptz not null default now(),
  constraint voter_initiative_signatures_link_chk check (voter_id is not null or key_registrant is not null)
);

-- Dedupe within a batch (expression index; no duplicated voter PII).
create unique index if not exists voter_initiative_signatures_line_uidx
  on public.voter_initiative_signatures (
    initiative,
    import_batch,
    (coalesce(voter_id, '')),
    (coalesce(key_registrant, ''))
  );

create index if not exists voter_initiative_signatures_voter_id_idx
  on public.voter_initiative_signatures (voter_id)
  where voter_id is not null;

create index if not exists voter_initiative_signatures_key_registrant_idx
  on public.voter_initiative_signatures (key_registrant)
  where key_registrant is not null;

create index if not exists voter_initiative_signatures_initiative_idx
  on public.voter_initiative_signatures (initiative);

create index if not exists voter_initiative_signatures_import_batch_idx
  on public.voter_initiative_signatures (import_batch);

create index if not exists voter_initiative_signatures_source_file_idx
  on public.voter_initiative_signatures (source_file_name);
