-- A deployment represents one nail business and its one WhatsApp Business Account.
-- Existing multi-business data must be consolidated deliberately before this migration.
do $$
begin
  if (select count(*) from public.businesses) > 1 then
    raise exception 'single_business_migration_requires_at_most_one_business';
  end if;
end;
$$;

alter table public.businesses
  add column singleton boolean not null default true check (singleton);

create unique index businesses_singleton_idx on public.businesses (singleton);

insert into public.businesses (name)
select 'Nail Salon'
where not exists (select 1 from public.businesses);

create or replace function public.create_booking_from_conversation(
  p_business_id uuid,
  p_salon_id uuid,
  p_contact_id uuid,
  p_starts_at timestamptz,
  p_timezone_snapshot text,
  p_local_time_label text,
  p_technician_ref uuid,
  p_technician_name_snapshot text,
  p_additional_request text,
  p_idempotency_key text,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_id uuid;
begin
  if not exists (
    select 1
    from public.businesses b
    join public.salons s on s.business_id = b.id
    where b.id = p_business_id
      and b.active
      and s.id = p_salon_id
      and s.active
      and s.deleted_at is null
  ) then
    raise exception 'business_or_salon_is_not_active';
  end if;

  insert into public.bookings (
    business_id, salon_id, contact_id, starts_at, timezone_snapshot,
    local_time_label, technician_ref, technician_name_snapshot,
    additional_request, idempotency_key
  ) values (
    p_business_id, p_salon_id, p_contact_id, p_starts_at, p_timezone_snapshot,
    p_local_time_label, p_technician_ref, p_technician_name_snapshot,
    p_additional_request, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into booking_id;

  if booking_id is null then
    select id into booking_id from public.bookings where idempotency_key = p_idempotency_key;
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
      last_booking_at = excluded.last_booking_at,
      updated_at = now();

  insert into public.booking_events (booking_id, event_type, actor_contact_id)
  values (booking_id, 'booking.confirmed', p_contact_id);
  return booking_id;
end;
$$;
