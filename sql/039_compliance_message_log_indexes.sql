-- Speed webhook lookups by provider id (SendGrid sg_message_id / Twilio MessageSid).

create index if not exists compliance_message_log_provider_message_id_idx
  on public.compliance_message_log(provider_message_id)
  where provider_message_id is not null;
