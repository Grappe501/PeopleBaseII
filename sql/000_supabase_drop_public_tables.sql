-- Optional: wipe user objects in public on an EXISTING Supabase project before re-running migrations.
-- Prefer creating a new Supabase project and pointing DATABASE_URL at it (no wipe needed).
-- Run via: npx tsx scripts/wipe-public-and-migrate.ts --confirm
-- Or paste into the Supabase SQL Editor, then: npm run db:migrate
--
-- Destroys all views, materialized views, and tables in public. Backup first.

do $$
declare
  r record;
begin
  for r in (select viewname from pg_views where schemaname = 'public') loop
    execute 'drop view if exists public.' || quote_ident(r.viewname) || ' cascade';
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in (select matviewname from pg_matviews where schemaname = 'public') loop
    execute 'drop materialized view if exists public.' || quote_ident(r.matviewname) || ' cascade';
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
  end loop;
end $$;
