-- Salon choice is a customer preference, not a booking prerequisite.
comment on column public.bookings.salon_id is
  'Optional customer salon preference. The booking always belongs to the singleton business.';

create or replace function public.create_booking_from_conversation(
  p_business_id uuid, p_salon_id uuid, p_contact_id uuid, p_starts_at timestamptz,
  p_timezone_snapshot text, p_local_time_label text, p_technician_ref uuid,
  p_technician_name_snapshot text, p_additional_request text, p_idempotency_key text,
  p_services jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  booking_id uuid;
  expected_timezone text;
begin
  select id into booking_id from public.bookings
  where idempotency_key = p_idempotency_key
    and business_id = p_business_id and contact_id = p_contact_id;
  if booking_id is not null then return booking_id; end if;

  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at <= now() then
    raise exception 'booking_time_must_be_in_future';
  end if;
  perform 1 from public.businesses where id = p_business_id and active for share;
  if not found then raise exception 'business_is_not_active'; end if;
  if p_salon_id is not null then
    perform 1 from public.salons
    where id = p_salon_id and business_id = p_business_id and active and deleted_at is null
    for share;
    if not found then raise exception 'salon_is_not_active'; end if;
  end if;
  select platform_timezone into expected_timezone
  from public.platform_settings where singleton for share;
  if p_timezone_snapshot is distinct from expected_timezone then
    raise exception 'booking_timezone_changed';
  end if;

  insert into public.bookings (
    business_id, salon_id, contact_id, starts_at, timezone_snapshot,
    local_time_label, technician_ref, technician_name_snapshot,
    additional_request, idempotency_key
  ) values (
    p_business_id, p_salon_id, p_contact_id, p_starts_at, p_timezone_snapshot,
    p_local_time_label, p_technician_ref, p_technician_name_snapshot,
    p_additional_request, p_idempotency_key
  ) on conflict (idempotency_key) do nothing returning id into booking_id;
  if booking_id is null then
    select id into booking_id from public.bookings where idempotency_key = p_idempotency_key
      and business_id = p_business_id and contact_id = p_contact_id;
    if booking_id is null then raise exception 'booking_key_conflict'; end if;
    return booking_id;
  end if;

  insert into public.booking_services (booking_id, service_id, service_name_snapshot, position)
  select booking_id, nullif(item->>'serviceId', '')::uuid, item->>'name', (ordinality - 1)::integer
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) with ordinality as selected(item, ordinality)
  where nullif(trim(item->>'name'), '') is not null;
  insert into public.business_customers (business_id, contact_id, first_booking_at, last_booking_at)
  values (p_business_id, p_contact_id, now(), now())
  on conflict (business_id, contact_id) do update
  set first_booking_at = coalesce(public.business_customers.first_booking_at, excluded.first_booking_at),
      last_booking_at = excluded.last_booking_at, updated_at = now();
  insert into public.booking_events (booking_id, event_type, actor_contact_id)
  values (booking_id, 'booking.confirmed', p_contact_id);
  return booking_id;
end;
$$;

create or replace function public.reschedule_customer_booking(
  p_booking_id uuid, p_contact_id uuid, p_salon_id uuid, p_starts_at timestamptz,
  p_timezone_snapshot text, p_local_time_label text, p_technician_ref uuid,
  p_technician_name_snapshot text, p_additional_request text, p_services jsonb,
  p_idempotency_key text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  booking public.bookings%rowtype;
  expected_timezone text;
  previous_services jsonb;
begin
  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at <= now() then
    raise exception 'booking_time_must_be_in_future';
  end if;
  select * into booking from public.bookings
  where id = p_booking_id and contact_id = p_contact_id for update;
  if not found or booking.status <> 'confirmed' or booking.starts_at <= now() then return false; end if;
  if exists (
    select 1 from public.booking_events where booking_id = p_booking_id
      and event_type = 'booking.rescheduled'
      and metadata ->> 'idempotencyKey' = p_idempotency_key
  ) then return true; end if;
  perform 1 from public.businesses where id = booking.business_id and active for share;
  if not found then raise exception 'business_is_not_active'; end if;
  if p_salon_id is not null then
    perform 1 from public.salons
    where id = p_salon_id and business_id = booking.business_id and active and deleted_at is null
    for share;
    if not found then raise exception 'salon_is_not_active'; end if;
  end if;
  select platform_timezone into expected_timezone
  from public.platform_settings where singleton for share;
  if p_timezone_snapshot is distinct from expected_timezone then
    raise exception 'booking_timezone_changed';
  end if;

  update public.bookings set salon_id = p_salon_id, starts_at = p_starts_at,
    timezone_snapshot = p_timezone_snapshot, local_time_label = p_local_time_label,
    technician_ref = p_technician_ref, technician_name_snapshot = p_technician_name_snapshot,
    additional_request = p_additional_request where id = p_booking_id;
  select coalesce(jsonb_agg(jsonb_build_object('serviceId', service_id, 'name', service_name_snapshot, 'position', position) order by position, id), '[]'::jsonb)
  into previous_services from public.booking_services where booking_id = p_booking_id;
  delete from public.booking_services where booking_id = p_booking_id;
  insert into public.booking_services (booking_id, service_id, service_name_snapshot, position)
  select p_booking_id, nullif(item->>'serviceId', '')::uuid, item->>'name', (ordinality - 1)::integer
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) with ordinality as selected(item, ordinality)
  where nullif(trim(item->>'name'), '') is not null;
  insert into public.booking_events (booking_id, event_type, actor_contact_id, metadata)
  values (p_booking_id, 'booking.rescheduled', p_contact_id, jsonb_build_object(
    'idempotencyKey', p_idempotency_key, 'previousStartsAt', booking.starts_at,
    'startsAt', p_starts_at, 'previousSalonId', booking.salon_id, 'salonId', p_salon_id,
    'previousTechnicianRef', booking.technician_ref, 'technicianRef', p_technician_ref,
    'previousServices', previous_services, 'services', coalesce(p_services, '[]'::jsonb),
    'additionalRequestChanged', p_additional_request is distinct from booking.additional_request
  ));
  return true;
end;
$$;

revoke all on function public.create_booking_from_conversation(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_booking_from_conversation(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, text, jsonb) to service_role;
revoke all on function public.reschedule_customer_booking(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.reschedule_customer_booking(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, jsonb, text) to service_role;
