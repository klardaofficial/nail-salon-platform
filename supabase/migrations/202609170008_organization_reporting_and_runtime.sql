-- Complete the organization-scoped runtime/reporting contracts before removing
-- their legacy single-tenant counterparts.

create view public.admin_organization_whatsapp_messages with (security_invoker = true) as
select
  e.organization_id,
  'inbound:' || e.id::text as id,
  e.contact_wa_id as wa_id,
  case when e.payload->>'simulated' = 'true' then 'whatsapp_simulator' else 'whatsapp' end as channel,
  'inbound'::text as direction,
  e.received_at as created_at,
  null::timestamptz as sent_at,
  case when e.processed_at is not null then 'processed'
    when e.failure_code is not null then 'failed'
    else coalesce(j.state::text, 'pending') end as state,
  e.payload->'message'->>'type' as message_type,
  coalesce(nullif(e.payload->'message'->>'text', ''),
    nullif(e.payload->'message'->>'interactiveTitle', ''),
    nullif(e.payload->'message'->>'interactiveId', ''),
    nullif(e.payload->'message'->>'caption', ''),
    '[' || coalesce(e.payload->'message'->>'type', 'unsupported') || ']') as text_content,
  e.payload->'message'->>'mediaId' as media_id,
  e.payload->>'profileName' as profile_name,
  null::jsonb as payload
from public.whatsapp_inbox_events e
left join lateral (
  select state from public.job_outbox
  where organization_id = e.organization_id and inbox_event_id = e.id
  order by created_at desc, id desc limit 1
) j on true
where e.event_kind = 'message' and e.contact_wa_id is not null
union all
select
  o.organization_id,
  'outbound:' || o.id::text,
  o.recipient_wa_id,
  case when o.payload->>'transport' = 'simulator' then 'whatsapp_simulator' else 'whatsapp' end,
  'outbound', o.created_at, o.sent_at,
  case when o.state = 'sent' and o.payload->>'transport' = 'simulator' then 'captured' else o.state::text end,
  o.message_kind,
  case o.message_kind
    when 'text' then o.payload->>'text'
    when 'image' then coalesce(nullif(o.payload->>'caption', ''), '[Image]')
    when 'template' then concat_ws(E'\n', o.payload->>'name',
      (select string_agg(value, E'\n' order by ordinal)
       from jsonb_array_elements_text(o.payload->'bodyParameters') with ordinality as p(value, ordinal)))
    else o.payload->>'body' end,
  o.payload->>'mediaId', null, o.payload
from public.message_outbox o;

revoke all on public.admin_organization_whatsapp_messages from public, anon, authenticated;
grant select on public.admin_organization_whatsapp_messages to service_role;

create function public.admin_whatsapp_threads(
  p_organization_id uuid, p_channel text, p_search text default '', p_role text default 'all',
  p_offset integer default 0, p_limit integer default 30
) returns jsonb language sql stable security invoker set search_path = public as $$
  with latest as (
    select distinct on (wa_id) wa_id, created_at, text_content, direction, profile_name
    from public.admin_organization_whatsapp_messages
    where organization_id = p_organization_id and channel = p_channel
    order by wa_id, created_at desc, id desc
  ), identities as (
    select l.*, coalesce(nullif(c.display_name, ''), t.name, nullif(l.profile_name, ''), l.wa_id) as name,
      array_remove(array[
        case when exists(select 1 from public.business_owners b
          where b.organization_id = p_organization_id and b.contact_id = c.id) then 'owner' end,
        case when t.name is not null then 'technician' end
      ], null) as roles
    from latest l
    left join public.contacts c on c.organization_id = p_organization_id and c.wa_id = l.wa_id
    left join lateral (
      select min(display_name) as name from public.technicians
      where organization_id = p_organization_id and wa_id = l.wa_id and active and deleted_at is null
    ) t on true
  ), filtered as (
    select * from identities
    where (p_search = '' or strpos(lower(name), lower(p_search)) > 0 or strpos(wa_id, p_search) > 0)
      and (p_role = 'all' or p_role = any(roles) or (p_role = 'customer' and cardinality(roles) = 0))
  ), page as (
    select * from filtered order by created_at desc, wa_id
    offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 100)
  )
  select jsonb_build_object('total', (select count(*) from filtered), 'conversations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'waId', wa_id, 'name', name, 'roles', roles, 'lastMessageAt', created_at,
      'lastMessage', left(text_content, 160), 'direction', direction
    ) order by created_at desc, wa_id) from page
  ), '[]'::jsonb));
$$;

revoke all on function public.admin_whatsapp_threads(uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_whatsapp_threads(uuid, text, text, text, integer, integer) to service_role;

create function public.admin_platform_activity(
  p_organization_id uuid, p_from date, p_to date, p_timezone text, p_channel text
) returns jsonb language sql stable security invoker set search_path = public as $$
  with bounds as (
    select p_from::timestamp at time zone p_timezone as start_at,
      (p_to + 1)::timestamp at time zone p_timezone as end_at
  ), received as (
    select e.contact_wa_id as wa_id, (e.received_at at time zone p_timezone)::date as day
    from public.whatsapp_inbox_events e, bounds b
    where e.organization_id = p_organization_id and e.event_kind = 'message'
      and e.received_at >= b.start_at and e.received_at < b.end_at
      and (p_channel = 'all' or p_channel = case when e.payload->>'simulated' = 'true' then 'whatsapp_simulator' else 'whatsapp' end)
  ), sent as (
    select (o.sent_at at time zone p_timezone)::date as day
    from public.message_outbox o, bounds b
    where o.organization_id = p_organization_id and o.sent_at >= b.start_at and o.sent_at < b.end_at
      and (p_channel = 'all' or p_channel = case when o.payload->>'transport' = 'simulator' then 'whatsapp_simulator' else 'whatsapp' end)
  ), usage as (
    select a.*, (a.started_at at time zone p_timezone)::date as day
    from public.ai_usage_events a, bounds b
    where a.organization_id = p_organization_id and a.started_at >= b.start_at and a.started_at < b.end_at
      and (p_channel = 'all' or a.channel = p_channel)
  ), days as (
    select p_from + n as day from generate_series(0, least(p_to - p_from, 365)) n
  ), received_daily as (
    select day, count(*) as received, count(distinct wa_id) as active from received group by day
  ), sent_daily as (
    select day, count(*) as sent from sent group by day
  ), usage_daily as (
    select day, count(*) filter (where kind = 'chat_text') as chat_calls,
      count(*) filter (where kind = 'image_generation') as image_calls,
      coalesce(sum(estimated_cost_usd) filter (where kind = 'chat_text'), 0) as chat_cost,
      coalesce(sum(estimated_cost_usd) filter (where kind = 'image_generation'), 0) as image_cost,
      count(*) filter (where estimated_cost_usd is null) as unpriced_calls
    from usage group by day
  ), breakdown as (
    select kind, model, channel, count(*) as calls,
      count(*) filter (where status = 'failed') as failed,
      count(*) filter (where status in ('started', 'incomplete')) as incomplete,
      count(*) filter (where input_tokens is null or output_tokens is null) as missing_usage,
      count(*) filter (where estimated_cost_usd is null) as unpriced_calls,
      coalesce(sum(input_tokens), 0) as input_tokens,
      coalesce(sum(cached_input_tokens), 0) as cached_input_tokens,
      coalesce(sum(input_text_tokens), 0) as input_text_tokens,
      coalesce(sum(input_image_tokens), 0) as input_image_tokens,
      coalesce(sum(output_tokens), 0) as output_tokens,
      coalesce(sum(image_count), 0) as images,
      coalesce(sum(estimated_cost_usd), 0) as cost
    from usage group by kind, model, channel
  )
  select jsonb_build_object(
    'received', (select count(*) from received),
    'sent', (select count(*) from sent),
    'activeUsers', (select count(distinct wa_id) from received),
    'ai', coalesce((select jsonb_agg(to_jsonb(b) order by kind, model, channel) from breakdown b), '[]'::jsonb),
    'trends', coalesce((select jsonb_agg(jsonb_build_object(
      'date', d.day, 'received', coalesce(r.received, 0), 'sent', coalesce(s.sent, 0),
      'activeUsers', coalesce(r.active, 0), 'chatCalls', coalesce(u.chat_calls, 0),
      'imageCalls', coalesce(u.image_calls, 0), 'chatCost', coalesce(u.chat_cost, 0),
      'imageCost', coalesce(u.image_cost, 0), 'unpricedCalls', coalesce(u.unpriced_calls, 0)
    ) order by d.day) from days d left join received_daily r using(day)
      left join sent_daily s using(day) left join usage_daily u using(day)), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_platform_activity(uuid, date, date, text, text) from public, anon, authenticated;
grant execute on function public.admin_platform_activity(uuid, date, date, text, text) to service_role;

create function public.complete_preview_request(
  p_organization_id uuid, p_request_id uuid, p_output_media_ids jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  preview public.preview_requests%rowtype;
  output_count integer;
begin
  select * into preview from public.preview_requests
  where organization_id = p_organization_id and id = p_request_id for update;
  if not found or preview.state in ('delivered', 'failed', 'released') then return; end if;

  output_count := jsonb_array_length(coalesce(p_output_media_ids, '[]'::jsonb));
  if output_count = 0 then
    update public.preview_requests set state = 'failed', failure_code = 'no_output'
    where organization_id = p_organization_id and id = p_request_id;
    update public.preview_usage set reserved_count = greatest(reserved_count - 1, 0), updated_at = now()
    where organization_id = p_organization_id and contact_id = preview.contact_id and usage_date = preview.usage_date;
    return;
  end if;

  update public.preview_requests
  set output_media_ids = p_output_media_ids, generated_count = least(output_count, 3),
      state = case when output_count >= requested_count then 'ready'::public.preview_state else 'partially_ready'::public.preview_state end
  where organization_id = p_organization_id and id = p_request_id;
  update public.preview_usage
  set reserved_count = greatest(reserved_count - 1, 0), consumed_count = consumed_count + 1, updated_at = now()
  where organization_id = p_organization_id and contact_id = preview.contact_id and usage_date = preview.usage_date;
end;
$$;

revoke all on function public.complete_preview_request(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_preview_request(uuid, uuid, jsonb) to service_role;

create function public.get_staff_booking_summary(
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

revoke all on function public.get_staff_booking_summary(uuid, uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_staff_booking_summary(uuid, uuid, text, timestamptz, timestamptz, text) to service_role;
