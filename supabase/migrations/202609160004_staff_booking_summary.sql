-- Aggregate in SQL so summaries are complete regardless of API row/page limits.
create function public.get_staff_booking_summary(
  p_contact_id uuid, p_role text, p_from timestamptz, p_to timestamptz, p_date_basis text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_business_id uuid;
  technician_ids uuid[];
  result jsonb;
begin
  if p_date_basis is null or p_date_basis not in ('appointment', 'created') then
    raise exception 'invalid_date_basis';
  end if;
  if p_from is not null and p_to is not null and p_from >= p_to then
    raise exception 'invalid_date_range';
  end if;
  if p_role = 'owner' then
    select business_id into owner_business_id from public.business_owners where contact_id = p_contact_id;
    if owner_business_id is null then raise exception 'not_authorized'; end if;
  elsif p_role = 'technician' then
    select array_agg(t.id) into technician_ids from public.technicians t
    join public.contacts c on c.wa_id = t.wa_id
    where c.id = p_contact_id and t.active and t.deleted_at is null;
    if coalesce(cardinality(technician_ids), 0) = 0 then raise exception 'not_authorized'; end if;
  else
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'confirmed', count(*) filter (where status = 'confirmed'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'customers', count(distinct contact_id),
    'from', p_from, 'to', p_to, 'dateBasis', p_date_basis
  ) into result
  from public.bookings b
  where ((p_role = 'owner' and b.business_id = owner_business_id)
      or (p_role = 'technician' and b.technician_ref = any(technician_ids)))
    and (p_from is null or (case when p_date_basis = 'appointment' then b.starts_at else b.created_at end) >= p_from)
    and (p_to is null or (case when p_date_basis = 'appointment' then b.starts_at else b.created_at end) < p_to);
  return result;
end;
$$;

revoke all on function public.get_staff_booking_summary(uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_staff_booking_summary(uuid, text, timestamptz, timestamptz, text) to service_role;
