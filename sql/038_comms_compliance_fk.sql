-- Optional FKs after both comms_queue and compliance_message_log exist (order-independent deploys).

do $$
begin
  if to_regclass('public.compliance_message_log') is not null
     and to_regclass('public.comms_queue') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'comms_queue_compliance_message_log_id_fkey'
     )
  then
    alter table public.comms_queue
      add constraint comms_queue_compliance_message_log_id_fkey
      foreign key (compliance_message_log_id) references public.compliance_message_log(id) on delete set null;
  end if;
end $$;
