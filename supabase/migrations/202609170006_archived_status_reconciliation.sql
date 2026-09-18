create or replace function public.register_whatsapp_event(
  p_organization_id uuid,
  p_provider_event_id text,
  p_event_kind text,
  p_contact_wa_id text,
  p_payload jsonb
)
returns table (accepted boolean, inbox_event_id uuid, job_outbox_id uuid)
language plpgsql security definer set search_path = public as $$
declare inserted_event_id uuid;
declare inserted_job_id uuid;
begin
  if not exists (
    select 1 from public.organizations
    where id = p_organization_id and (status = 'active' or p_event_kind = 'status')
  ) then return query select false, null::uuid, null::uuid; return; end if;
  insert into public.whatsapp_inbox_events (organization_id, provider_event_id, event_kind, contact_wa_id, payload)
  values (p_organization_id, p_provider_event_id, p_event_kind, p_contact_wa_id, p_payload)
  on conflict (organization_id, provider_event_id) do nothing returning id into inserted_event_id;
  if inserted_event_id is null then
    select id into inserted_event_id from public.whatsapp_inbox_events
    where organization_id = p_organization_id and provider_event_id = p_provider_event_id;
    return query select false, inserted_event_id, null::uuid; return;
  end if;
  insert into public.job_outbox (organization_id, inbox_event_id, job_name, payload)
  values (p_organization_id, inserted_event_id, 'whatsapp/process-event',
    jsonb_build_object('inboxEventId', inserted_event_id, 'organizationId', p_organization_id))
  returning id into inserted_job_id;
  return query select true, inserted_event_id, inserted_job_id;
end;
$$;
