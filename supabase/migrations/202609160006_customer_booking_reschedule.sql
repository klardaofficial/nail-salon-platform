-- A future confirmed booking can be rescheduled by its customer without creating
-- a cancelled record and a replacement booking.
create unique index booking_rescheduled_idempotency_idx
on public.booking_events (booking_id, (metadata ->> 'idempotencyKey'))
where event_type = 'booking.rescheduled' and metadata ? 'idempotencyKey';

create function public.reschedule_customer_booking(
  p_booking_id uuid,
  p_contact_id uuid,
  p_salon_id uuid,
  p_starts_at timestamptz,
  p_timezone_snapshot text,
  p_local_time_label text,
  p_technician_ref uuid,
  p_technician_name_snapshot text,
  p_additional_request text,
  p_services jsonb,
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.bookings%rowtype;
  active_salon_ids uuid[];
  expected_timezone text;
  previous_services jsonb;
begin
  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at <= now() then
    raise exception 'booking_time_must_be_in_future';
  end if;

  select * into booking
  from public.bookings
  where id = p_booking_id and contact_id = p_contact_id
  for update;
  if not found or booking.status <> 'confirmed' or booking.starts_at <= now() then
    return false;
  end if;

  if exists (
    select 1 from public.booking_events
    where booking_id = p_booking_id
      and event_type = 'booking.rescheduled'
      and metadata ->> 'idempotencyKey' = p_idempotency_key
  ) then
    return true;
  end if;

  perform 1 from public.businesses where id = booking.business_id and active for share;
  if not found then raise exception 'business_is_not_active'; end if;
  select array_agg(id order by id) into active_salon_ids
  from public.salons
  where business_id = booking.business_id and active and deleted_at is null;
  if p_salon_id is null and cardinality(active_salon_ids) > 1 then
    raise exception 'salon_selection_required';
  end if;
  if p_salon_id is null then p_salon_id := active_salon_ids[1]; end if;
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

  update public.bookings
  set salon_id = p_salon_id,
      starts_at = p_starts_at,
      timezone_snapshot = p_timezone_snapshot,
      local_time_label = p_local_time_label,
      technician_ref = p_technician_ref,
      technician_name_snapshot = p_technician_name_snapshot,
      additional_request = p_additional_request
  where id = p_booking_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('serviceId', service_id, 'name', service_name_snapshot, 'position', position)
      order by position, id
    ),
    '[]'::jsonb
  ) into previous_services
  from public.booking_services
  where booking_id = p_booking_id;
  delete from public.booking_services where booking_id = p_booking_id;
  insert into public.booking_services (booking_id, service_id, service_name_snapshot, position)
  select p_booking_id, nullif(item->>'serviceId', '')::uuid, item->>'name', (ordinality - 1)::integer
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) with ordinality as selected(item, ordinality)
  where nullif(trim(item->>'name'), '') is not null;

  insert into public.booking_events (booking_id, event_type, actor_contact_id, metadata)
  values (
    p_booking_id,
    'booking.rescheduled',
    p_contact_id,
    jsonb_build_object(
      'idempotencyKey', p_idempotency_key,
      'previousStartsAt', booking.starts_at,
      'startsAt', p_starts_at,
      'previousSalonId', booking.salon_id,
      'salonId', p_salon_id,
      'previousTechnicianRef', booking.technician_ref,
      'technicianRef', p_technician_ref,
      'previousServices', previous_services,
      'services', coalesce(p_services, '[]'::jsonb),
      'additionalRequestChanged', p_additional_request is distinct from booking.additional_request
    )
  );
  return true;
end;
$$;

revoke all on function public.reschedule_customer_booking(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.reschedule_customer_booking(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, jsonb, text) to service_role;
