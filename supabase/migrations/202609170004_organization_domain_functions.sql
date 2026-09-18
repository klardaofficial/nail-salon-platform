alter table public.bookings drop constraint if exists bookings_idempotency_key_key;
create unique index bookings_organization_idempotency_key
  on public.bookings (organization_id, idempotency_key);

create function public.create_organization_booking(
  p_organization_id uuid, p_business_id uuid, p_salon_id uuid, p_contact_id uuid,
  p_starts_at timestamptz, p_timezone_snapshot text, p_local_time_label text,
  p_technician_ref uuid, p_technician_name_snapshot text, p_additional_request text,
  p_idempotency_key text, p_services jsonb, p_channel text
) returns uuid language plpgsql security definer set search_path = public as $$
declare booking_id uuid;
declare is_simulated boolean := p_channel = 'whatsapp_simulator';
begin
  select id into booking_id from public.bookings
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key
    and contact_id = p_contact_id;
  if booking_id is not null then return booking_id; end if;
  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at <= now() then
    raise exception 'booking_time_must_be_in_future';
  end if;
  perform 1 from public.organizations where id = p_organization_id and status = 'active';
  if not found then raise exception 'organization_is_not_active'; end if;
  perform 1 from public.businesses
  where id = p_business_id and organization_id = p_organization_id and active;
  if not found then raise exception 'business_is_not_active'; end if;
  perform 1 from public.contacts where id = p_contact_id and organization_id = p_organization_id;
  if not found then raise exception 'contact_not_in_organization'; end if;
  if p_salon_id is not null then
    perform 1 from public.salons where id = p_salon_id and organization_id = p_organization_id
      and business_id = p_business_id and active and deleted_at is null;
    if not found then raise exception 'salon_is_not_active'; end if;
  end if;
  if p_timezone_snapshot is distinct from (
    select platform_timezone from public.organization_settings where organization_id = p_organization_id
  ) then raise exception 'booking_timezone_changed'; end if;
  if p_technician_ref is not null and not exists (
    select 1 from public.technicians where id = p_technician_ref
      and organization_id = p_organization_id and salon_id = p_salon_id
      and active and deleted_at is null
  ) then p_technician_ref := null; p_technician_name_snapshot := null; end if;

  insert into public.bookings (
    organization_id, business_id, salon_id, contact_id, starts_at, timezone_snapshot,
    local_time_label, technician_ref, technician_name_snapshot, additional_request,
    idempotency_key, simulated
  ) values (
    p_organization_id, p_business_id, p_salon_id, p_contact_id, p_starts_at,
    p_timezone_snapshot, p_local_time_label, p_technician_ref,
    p_technician_name_snapshot, p_additional_request, p_idempotency_key, is_simulated
  ) on conflict (organization_id, idempotency_key) do nothing returning id into booking_id;
  if booking_id is null then
    select id into booking_id from public.bookings
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key
      and contact_id = p_contact_id;
    if booking_id is null then raise exception 'booking_key_conflict'; end if;
    return booking_id;
  end if;
  insert into public.booking_services (
    organization_id, booking_id, service_id, service_name_snapshot, position
  ) select p_organization_id, booking_id,
    case when exists(select 1 from public.services where id = nullif(item->>'serviceId', '')::uuid and organization_id = p_organization_id)
      then nullif(item->>'serviceId', '')::uuid else null end,
    item->>'name', (ordinality - 1)::integer
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) with ordinality selected(item, ordinality)
  where nullif(btrim(item->>'name'), '') is not null;
  insert into public.business_customers (
    organization_id, business_id, contact_id, first_booking_at, last_booking_at
  ) values (p_organization_id, p_business_id, p_contact_id, now(), now())
  on conflict (business_id, contact_id) do update set
    first_booking_at = coalesce(public.business_customers.first_booking_at, excluded.first_booking_at),
    last_booking_at = excluded.last_booking_at, updated_at = now();
  insert into public.booking_events (organization_id, booking_id, event_type, actor_contact_id)
  values (p_organization_id, booking_id, 'booking.confirmed', p_contact_id);
  return booking_id;
end;
$$;

create function public.cancel_organization_booking(
  p_organization_id uuid, p_booking_id uuid, p_contact_id uuid, p_reason text
) returns boolean language plpgsql security definer set search_path = public as $$
declare changed_id uuid;
begin
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = p_booking_id and organization_id = p_organization_id and contact_id = p_contact_id
    and status = 'confirmed' and starts_at > now() returning id into changed_id;
  if changed_id is null then return false; end if;
  insert into public.booking_events (organization_id, booking_id, event_type, actor_contact_id)
  values (p_organization_id, changed_id, 'booking.cancelled', p_contact_id);
  return true;
end;
$$;

create function public.reschedule_organization_booking(
  p_organization_id uuid, p_booking_id uuid, p_contact_id uuid, p_salon_id uuid,
  p_starts_at timestamptz, p_timezone_snapshot text, p_local_time_label text,
  p_technician_ref uuid, p_technician_name_snapshot text, p_additional_request text,
  p_services jsonb, p_idempotency_key text
) returns boolean language plpgsql security definer set search_path = public as $$
declare booking public.bookings%rowtype;
begin
  select * into booking from public.bookings where id = p_booking_id
    and organization_id = p_organization_id and contact_id = p_contact_id for update;
  if not found or booking.status <> 'confirmed' or booking.starts_at <= now() then return false; end if;
  if p_starts_at <= now() then raise exception 'booking_time_must_be_in_future'; end if;
  if exists(select 1 from public.booking_events where organization_id = p_organization_id
    and booking_id = p_booking_id and event_type = 'booking.rescheduled'
    and metadata->>'idempotencyKey' = p_idempotency_key) then return true; end if;
  if p_salon_id is not null and not exists(select 1 from public.salons where id = p_salon_id
    and organization_id = p_organization_id and business_id = booking.business_id
    and active and deleted_at is null) then raise exception 'salon_is_not_active'; end if;
  if p_timezone_snapshot is distinct from (select platform_timezone from public.organization_settings
    where organization_id = p_organization_id) then raise exception 'booking_timezone_changed'; end if;
  if p_technician_ref is not null and not exists(select 1 from public.technicians
    where id = p_technician_ref and organization_id = p_organization_id
      and salon_id = p_salon_id and active and deleted_at is null)
    then p_technician_ref := null; p_technician_name_snapshot := null; end if;
  update public.bookings set salon_id = p_salon_id, starts_at = p_starts_at,
    timezone_snapshot = p_timezone_snapshot, local_time_label = p_local_time_label,
    technician_ref = p_technician_ref, technician_name_snapshot = p_technician_name_snapshot,
    additional_request = p_additional_request
  where id = p_booking_id and organization_id = p_organization_id;
  delete from public.booking_services where booking_id = p_booking_id and organization_id = p_organization_id;
  insert into public.booking_services (organization_id, booking_id, service_id, service_name_snapshot, position)
  select p_organization_id, p_booking_id,
    case when exists(select 1 from public.services where id = nullif(item->>'serviceId', '')::uuid and organization_id = p_organization_id)
      then nullif(item->>'serviceId', '')::uuid else null end,
    item->>'name', (ordinality - 1)::integer
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) with ordinality selected(item, ordinality)
  where nullif(btrim(item->>'name'), '') is not null;
  insert into public.booking_events (organization_id, booking_id, event_type, actor_contact_id, metadata)
  values (p_organization_id, p_booking_id, 'booking.rescheduled', p_contact_id,
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'previousStartsAt', booking.starts_at,
      'startsAt', p_starts_at, 'previousSalonId', booking.salon_id, 'salonId', p_salon_id,
      'previousTechnicianRef', booking.technician_ref, 'technicianRef', p_technician_ref,
      'additionalRequestChanged', p_additional_request is distinct from booking.additional_request));
  return true;
end;
$$;

create function public.reserve_organization_preview(
  p_organization_id uuid, p_contact_id uuid, p_conversation_id uuid, p_request_key text,
  p_usage_date date, p_source_media_id text, p_style_request text,
  p_requested_count integer, p_daily_limit integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare request_id uuid; declare usage_row public.preview_usage%rowtype;
begin
  if not exists(select 1 from public.contacts where id = p_contact_id and organization_id = p_organization_id)
    or not exists(select 1 from public.conversations where id = p_conversation_id and organization_id = p_organization_id)
    then raise exception 'preview_scope_mismatch'; end if;
  select id into request_id from public.preview_requests where organization_id = p_organization_id
    and contact_id = p_contact_id and request_key = p_request_key;
  if request_id is not null then return request_id; end if;
  insert into public.preview_usage (organization_id, contact_id, usage_date)
  values (p_organization_id, p_contact_id, p_usage_date) on conflict do nothing;
  select * into usage_row from public.preview_usage where organization_id = p_organization_id
    and contact_id = p_contact_id and usage_date = p_usage_date for update;
  if usage_row.reserved_count + usage_row.consumed_count >= p_daily_limit then
    raise exception 'preview_quota_exceeded'; end if;
  update public.preview_usage set reserved_count = reserved_count + 1, updated_at = now()
  where organization_id = p_organization_id and contact_id = p_contact_id and usage_date = p_usage_date;
  insert into public.preview_requests (organization_id, contact_id, conversation_id, request_key,
    usage_date, source_media_id, style_request, requested_count)
  values (p_organization_id, p_contact_id, p_conversation_id, p_request_key, p_usage_date,
    p_source_media_id, p_style_request, least(greatest(p_requested_count, 1), 3)) returning id into request_id;
  return request_id;
end;
$$;

revoke all on function public.create_organization_booking(uuid,uuid,uuid,uuid,timestamptz,text,text,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.cancel_organization_booking(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.reschedule_organization_booking(uuid,uuid,uuid,uuid,timestamptz,text,text,uuid,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.reserve_organization_preview(uuid,uuid,uuid,text,date,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.create_organization_booking(uuid,uuid,uuid,uuid,timestamptz,text,text,uuid,text,text,text,jsonb,text) to service_role;
grant execute on function public.cancel_organization_booking(uuid,uuid,uuid,text) to service_role;
grant execute on function public.reschedule_organization_booking(uuid,uuid,uuid,uuid,timestamptz,text,text,uuid,text,text,jsonb,text) to service_role;
grant execute on function public.reserve_organization_preview(uuid,uuid,uuid,text,date,text,text,integer,integer) to service_role;
