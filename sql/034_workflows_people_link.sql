/*
  Workflows → People link
  Adds person_id to workflow_tasks so tasks can link directly to canonical people records.
*/

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workflow_tasks'
      and column_name = 'person_id'
  ) then
    alter table public.workflow_tasks
      add column person_id uuid null;
  end if;
end $$;

do $$
begin
  -- Add FK only if it doesn't already exist.
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_tasks_person_id_fkey'
      and conrelid = 'public.workflow_tasks'::regclass
  ) then
    alter table public.workflow_tasks
      add constraint workflow_tasks_person_id_fkey
      foreign key (person_id) references public.people(id) on delete set null;
  end if;
end $$;

create index if not exists workflow_tasks_person_id_idx on public.workflow_tasks(person_id);

