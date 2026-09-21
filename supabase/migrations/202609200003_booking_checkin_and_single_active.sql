-- Adds the check-in status (customer physically served, confirmed by an
-- owner/technician scanning a WhatsApp QR -- see
-- src/features/bookings/checkin-code.ts and checkin-qr.ts) and enforces one
-- active (confirmed, future) booking per customer. A checked-in booking does
-- not count as active, so finishing a visit immediately frees the customer to
-- book again.
alter table public.bookings
  add column checked_in_at timestamptz,
  add column checked_in_by_contact_id uuid references public.contacts(id) on delete set null;

comment on column public.bookings.checked_in_at is
  'Set when an owner/technician scans the customer QR and the booking transitions to checked_in. Null otherwise.';
comment on column public.bookings.checked_in_by_contact_id is
  'The staff contact who performed the check-in. Set to null if that contact is later deleted; the booking_events row keeps the original actor.';

-- The original status/timestamp guard (202609150001_initial_schema.sql) is an
-- unnamed check constraint, so its generated name cannot be assumed here --
-- find it by definition instead of by name.
do $$
declare
  legacy_constraint_name text;
begin
  select conname into legacy_constraint_name
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%cancelled_at%';
  if legacy_constraint_name is not null then
    execute format('alter table public.bookings drop constraint %I', legacy_constraint_name);
  end if;
end;
$$;

alter table public.bookings add constraint bookings_status_timestamps_check
  check ((status = 'cancelled' and cancelled_at is not null)
      or (status = 'checked_in' and checked_in_at is not null)
      or status = 'confirmed');

-- create_organization_booking gains the one-active-booking-per-customer
-- guard. Signature stays byte-identical to
-- 202609170004_organization_domain_functions.sql so the existing
-- revoke/grant pair there stays in force. Body copied verbatim from the
-- current definition (202609190003_fix_booking_totals_variable_reference.sql)
-- with one addition: an advisory lock (keyed by organization+contact, so it
-- never blocks unrelated bookings) followed by the active-booking check,
-- inserted right after the idempotency short-circuit so a retried request
-- with the same key still returns the same booking instead of raising.
create or replace function public.create_organization_booking(
  p_organization_id uuid, p_business_id uuid, p_salon_id uuid, p_contact_id uuid,
  p_starts_at timestamptz, p_timezone_snapshot text, p_local_time_label text,
  p_technician_ref uuid, p_technician_name_snapshot text, p_additional_request text,
  p_idempotency_key text, p_services jsonb, p_channel text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_booking_id uuid;
declare is_simulated boolean := p_channel = 'whatsapp_simulator';
begin
  select id into v_booking_id from public.bookings
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key
    and contact_id = p_contact_id;
  if v_booking_id is not null then return v_booking_id; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_contact_id::text, 0));
  if exists (
    select 1 from public.bookings
    where organization_id = p_organization_id and contact_id = p_contact_id
      and status = 'confirmed' and starts_at > now()
  ) then raise exception 'active_booking_exists'; end if;
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
  ) on conflict (organization_id, idempotency_key) do nothing returning id into v_booking_id;
  if v_booking_id is null then
    select id into v_booking_id from public.bookings
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key
      and contact_id = p_contact_id;
    if v_booking_id is null then raise exception 'booking_key_conflict'; end if;
    return v_booking_id;
  end if;
  insert into public.booking_services (
    organization_id, booking_id, service_id, service_name_snapshot, position
  ) select p_organization_id, v_booking_id,
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
       where bs.booking_id = v_booking_id and bs.organization_id = p_organization_id
    ) as totals
   where b.id = v_booking_id and b.organization_id = p_organization_id;
  insert into public.business_customers (
    organization_id, business_id, contact_id, first_booking_at, last_booking_at
  ) values (p_organization_id, p_business_id, p_contact_id, now(), now())
  on conflict (business_id, contact_id) do update set
    first_booking_at = coalesce(public.business_customers.first_booking_at, excluded.first_booking_at),
    last_booking_at = excluded.last_booking_at, updated_at = now();
  insert into public.booking_events (organization_id, booking_id, event_type, actor_contact_id)
  values (p_organization_id, v_booking_id, 'booking.confirmed', p_contact_id);
  return v_booking_id;
end;
$$;

-- Checked-in bookings gain their own bucket in staff summaries, alongside
-- confirmed/cancelled. Body copied verbatim from
-- 202609170008_organization_reporting_and_runtime.sql with that one addition.
-- The legacy 5-arg overload (202609160004_staff_booking_summary.sql) predates
-- multi-tenancy and is unrelated/unused; left untouched.
create or replace function public.get_staff_booking_summary(
  p_organization_id uuid, p_contact_id uuid, p_role text,
  p_from timestamptz, p_to timestamptz, p_date_basis text
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  owner_business_id uuid;
  technician_ids uuid[];
  result jsonb;
begin
  if p_date_basis is null or p_date_basis not in ('appointment', 'created') then raise exception 'invalid_date_basis'; end if;
  if p_from is not null and p_to is not null and p_from >= p_to then raise exception 'invalid_date_range'; end if;
  if not exists(select 1 from public.contacts where organization_id = p_organization_id and id = p_contact_id) then
    raise exception 'not_authorized';
  end if;
  if p_role = 'owner' then
    select business_id into owner_business_id from public.business_owners
    where organization_id = p_organization_id and contact_id = p_contact_id;
    if owner_business_id is null then raise exception 'not_authorized'; end if;
  elsif p_role = 'technician' then
    select array_agg(t.id) into technician_ids from public.technicians t
    join public.contacts c on c.organization_id = t.organization_id and c.wa_id = t.wa_id
    where t.organization_id = p_organization_id and c.id = p_contact_id
      and t.active and t.deleted_at is null;
    if coalesce(cardinality(technician_ids), 0) = 0 then raise exception 'not_authorized'; end if;
  else
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'total', count(*), 'confirmed', count(*) filter (where status = 'confirmed'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'checkedIn', count(*) filter (where status = 'checked_in'),
    'customers', count(distinct contact_id), 'from', p_from, 'to', p_to, 'dateBasis', p_date_basis
  ) into result from public.bookings b
  where b.organization_id = p_organization_id and not b.simulated
    and ((p_role = 'owner' and b.business_id = owner_business_id)
      or (p_role = 'technician' and b.technician_ref = any(technician_ids)))
    and (p_from is null or (case when p_date_basis = 'appointment' then b.starts_at else b.created_at end) >= p_from)
    and (p_to is null or (case when p_date_basis = 'appointment' then b.starts_at else b.created_at end) < p_to);
  return result;
end;
$$;

-- Authorization choke point for check-in: staff scope always comes from
-- stored mappings (business_owners by contact_id, active technicians by
-- wa_id+organization_id), never a text claim. Any owner or technician of the
-- booking's own business may check it in. Idempotent: checking in an
-- already-checked-in booking succeeds with alreadyCheckedIn=true rather than
-- erroring, since a QR can be scanned more than once.
create function public.checkin_organization_booking(
  p_organization_id uuid, p_booking_id uuid, p_actor_contact_id uuid, p_actor_wa_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  booking public.bookings%rowtype;
  is_owner boolean;
  is_technician boolean;
  customer_name text;
begin
  select * into booking from public.bookings
  where id = p_booking_id and organization_id = p_organization_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select exists(
    select 1 from public.business_owners
    where organization_id = p_organization_id and contact_id = p_actor_contact_id
      and business_id = booking.business_id
  ) into is_owner;

  if not is_owner then
    select exists(
      select 1 from public.technicians t
      join public.salons s on s.id = t.salon_id and s.organization_id = t.organization_id
      where t.organization_id = p_organization_id and t.wa_id = p_actor_wa_id
        and t.active and t.deleted_at is null and s.business_id = booking.business_id
    ) into is_technician;
  end if;

  if not is_owner and not coalesce(is_technician, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  if booking.status = 'checked_in' then
    return jsonb_build_object('ok', true, 'alreadyCheckedIn', true, 'bookingId', booking.id);
  end if;
  if booking.status <> 'confirmed' then
    return jsonb_build_object('ok', false, 'reason', 'not_checkinable');
  end if;

  update public.bookings set status = 'checked_in', checked_in_at = now(),
    checked_in_by_contact_id = p_actor_contact_id
  where id = booking.id and organization_id = p_organization_id;

  insert into public.booking_events (organization_id, booking_id, event_type, actor_contact_id)
  values (p_organization_id, booking.id, 'booking.checked_in', p_actor_contact_id);

  select display_name into customer_name from public.contacts where id = booking.contact_id;

  return jsonb_build_object('ok', true, 'alreadyCheckedIn', false, 'bookingId', booking.id,
    'customerName', coalesce(customer_name, ''), 'localTimeLabel', booking.local_time_label);
end;
$$;

revoke all on function public.checkin_organization_booking(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.checkin_organization_booking(uuid,uuid,uuid,text) to service_role;
