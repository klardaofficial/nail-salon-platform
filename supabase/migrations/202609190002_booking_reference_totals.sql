-- Each booking records an advisory total of what was booked, so a booking
-- carries a rough sense of its own value without anyone re-pricing it later.
-- Unlike services.price/duration_minutes, an unset component here counts as 0
-- rather than staying null: this is a single summary number, not a place that
-- needs to distinguish "free" from "unknown" (see docs/architecture/data-model.md).
-- not null default 0 backfills existing rows automatically.
alter table public.bookings
  add column refer_price numeric(10,2) not null default 0,
  add column refer_duration integer not null default 0;

comment on column public.bookings.refer_price is
  'Advisory total at booking time, summed from the services on the booking. Services with no price/duration count as 0. Recomputed on reschedule. Never authoritative and never blocks booking.';
comment on column public.bookings.refer_duration is
  'Advisory total at booking time, summed from the services on the booking. Services with no price/duration count as 0. Recomputed on reschedule. Never authoritative and never blocks booking.';

-- create_organization_booking and reschedule_organization_booking are
-- replaced with argument signatures byte-identical to
-- 202609170004_organization_domain_functions.sql, so the existing
-- revoke/grant pair there stays in force and no call site changes. Each body
-- is copied verbatim with one addition: after the booking_services rows are
-- written, sum price/duration_minutes back from those rows (left-joined to
-- services, since service_id may be null for a free-text "Other" entry) and
-- write the total onto the booking. Summing the stored rows -- rather than
-- re-parsing p_services -- means a null service_id contributes 0 via the left
-- join, a blank-named entry was already filtered out before insertion, and a
-- service listed twice counts twice, matching booking_services having no
-- uniqueness constraint.
create or replace function public.create_organization_booking(
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
  update public.bookings b
     set refer_price = totals.price, refer_duration = totals.duration
    from (
      select coalesce(sum(coalesce(s.price, 0)), 0) as price,
             coalesce(sum(coalesce(s.duration_minutes, 0)), 0)::integer as duration
        from public.booking_services bs
        left join public.services s
          on s.id = bs.service_id and s.organization_id = p_organization_id
       where bs.booking_id = booking_id and bs.organization_id = p_organization_id
    ) as totals
   where b.id = booking_id and b.organization_id = p_organization_id;
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

create or replace function public.reschedule_organization_booking(
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
  update public.bookings b
     set refer_price = totals.price, refer_duration = totals.duration
    from (
      select coalesce(sum(coalesce(s.price, 0)), 0) as price,
             coalesce(sum(coalesce(s.duration_minutes, 0)), 0)::integer as duration
        from public.booking_services bs
        left join public.services s
          on s.id = bs.service_id and s.organization_id = p_organization_id
       where bs.booking_id = p_booking_id and bs.organization_id = p_organization_id
    ) as totals
   where b.id = p_booking_id and b.organization_id = p_organization_id;
  insert into public.booking_events (organization_id, booking_id, event_type, actor_contact_id, metadata)
  values (p_organization_id, p_booking_id, 'booking.rescheduled', p_contact_id,
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'previousStartsAt', booking.starts_at,
      'startsAt', p_starts_at, 'previousSalonId', booking.salon_id, 'salonId', p_salon_id,
      'previousTechnicianRef', booking.technician_ref, 'technicianRef', p_technician_ref,
      'additionalRequestChanged', p_additional_request is distinct from booking.additional_request));
  return true;
end;
$$;
