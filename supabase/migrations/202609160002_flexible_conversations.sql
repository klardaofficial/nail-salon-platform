-- Conversation language follows the customer; BOT_LOCALE remains the default.
alter table public.conversations
  add column reply_locale text check (reply_locale in ('en', 'de'));

alter table public.platform_settings
  drop column greeting_en,
  drop column greeting_de;

alter table public.bookings alter column salon_id drop not null;
comment on column public.bookings.salon_id is
  'Optional when no active salons exist. The booking still belongs to the singleton business.';

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
  active_salon_ids uuid[];
  expected_timezone text;
begin
  -- Replays return the original result, even after the appointment or catalog changes.
  select id into booking_id from public.bookings
  where idempotency_key = p_idempotency_key
    and business_id = p_business_id and contact_id = p_contact_id;
  if booking_id is not null then return booking_id; end if;

  if p_starts_at is null or not isfinite(p_starts_at) or p_starts_at <= now() then
    raise exception 'booking_time_must_be_in_future';
  end if;
  perform 1 from public.businesses where id = p_business_id and active for share;
  if not found then raise exception 'business_is_not_active'; end if;

  select array_agg(id order by id) into active_salon_ids
  from public.salons where business_id = p_business_id and active and deleted_at is null;
  if p_salon_id is null then
    if cardinality(active_salon_ids) > 1 then
      raise exception 'salon_selection_required';
    end if;
    p_salon_id := active_salon_ids[1];
  end if;

  if p_salon_id is not null then
    select timezone into expected_timezone from public.salons
    where id = p_salon_id and business_id = p_business_id and active and deleted_at is null
    for share;
    if not found then raise exception 'salon_is_not_active'; end if;
  else
    select platform_timezone into expected_timezone from public.platform_settings where singleton;
  end if;
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
  )
  on conflict (idempotency_key) do nothing
  returning id into booking_id;

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
      last_booking_at = excluded.last_booking_at,
      updated_at = now();

  insert into public.booking_events (booking_id, event_type, actor_contact_id)
  values (booking_id, 'booking.confirmed', p_contact_id);
  return booking_id;
end;
$$;

revoke all on function public.create_booking_from_conversation(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_booking_from_conversation(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, text, jsonb) to service_role;
