-- Repair older local DBs where voter_initiative_signatures existed without the expression unique index
-- (e.g. partial apply or an earlier draft). Safe to re-run.

alter table public.voter_initiative_signatures
  drop constraint if exists voter_initiative_signatures_line_uniq;

alter table public.voter_initiative_signatures
  drop column if exists voter_id_key cascade;

alter table public.voter_initiative_signatures
  drop column if exists key_registrant_key cascade;

drop index if exists voter_initiative_signatures_line_uidx;

create unique index if not exists voter_initiative_signatures_line_uidx
  on public.voter_initiative_signatures (
    initiative,
    import_batch,
    (coalesce(voter_id, '')),
    (coalesce(key_registrant, ''))
  );
