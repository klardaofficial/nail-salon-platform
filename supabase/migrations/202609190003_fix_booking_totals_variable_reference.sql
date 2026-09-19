-- The advisory-total query added by 202609190002 referred to the local
-- booking_id variable without qualification. Because booking_services also
-- has a booking_id column, PostgreSQL rejects the query as ambiguous and
-- rolls back every new booking. Use a distinctly named local variable.
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
