-- Numeric provider usage only: never persist prompts, responses, or image bytes here.
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  preview_request_id uuid references public.preview_requests(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'whatsapp_simulator')),
  kind text not null check (kind in ('chat_text', 'image_generation')),
  model text not null,
  status text not null default 'started' check (status in ('started', 'completed', 'incomplete', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  response_id text,
  provider_request_id text,
  input_tokens bigint check (input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens >= 0),
  input_text_tokens bigint check (input_text_tokens >= 0),
  input_image_tokens bigint check (input_image_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  output_text_tokens bigint check (output_text_tokens >= 0),
  output_image_tokens bigint check (output_image_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  estimated_cost_usd numeric(20,10) check (estimated_cost_usd >= 0),
  pricing jsonb,
  failure_code text
);

alter table public.ai_usage_events enable row level security;
create policy platform_admin_read on public.ai_usage_events for select to authenticated
  using (public.is_platform_admin());
revoke all on public.ai_usage_events from anon, authenticated;
grant select on public.ai_usage_events to authenticated;
grant all on public.ai_usage_events to service_role;
create index ai_usage_events_period_idx on public.ai_usage_events (channel, started_at desc, id desc);
create index whatsapp_inbox_messages_period_idx on public.whatsapp_inbox_events (received_at, id)
  where event_kind = 'message';
create index whatsapp_inbox_contact_messages_idx on public.whatsapp_inbox_events (contact_wa_id, received_at desc, id desc)
  where event_kind = 'message';
create index message_outbox_recipient_idx on public.message_outbox (recipient_wa_id, created_at desc, id desc);
create index message_outbox_sent_idx on public.message_outbox (sent_at) where sent_at is not null;

-- One row per actual inbound event or logical outbound message. History is not
-- unioned in again: that would duplicate messages and substitute AI-normalized text.
create view public.admin_whatsapp_messages with (security_invoker = true) as
select
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
  select state from public.job_outbox where inbox_event_id = e.id
  order by created_at desc, id desc limit 1
) j on true
where e.event_kind = 'message' and e.contact_wa_id is not null
union all
select
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
      (select string_agg(value, E'\n' order by ordinal) from jsonb_array_elements_text(o.payload->'bodyParameters') with ordinality as p(value, ordinal)))
    else o.payload->>'body' end,
  o.payload->>'mediaId', null, o.payload
from public.message_outbox o;

revoke all on public.admin_whatsapp_messages from public, anon, authenticated;
grant select on public.admin_whatsapp_messages to service_role;

create function public.admin_whatsapp_threads(
  p_channel text, p_search text default '', p_role text default 'all',
  p_offset integer default 0, p_limit integer default 30
) returns jsonb language sql stable security invoker set search_path = public as $$
  with latest as (
    select distinct on (wa_id) wa_id, created_at, text_content, direction, profile_name
    from public.admin_whatsapp_messages where channel = p_channel
    order by wa_id, created_at desc, id desc
  ), identities as (
    select l.*, coalesce(nullif(c.display_name, ''), t.name, nullif(l.profile_name, ''), l.wa_id) as name,
      array_remove(array[
        case when exists(select 1 from public.business_owners b where b.contact_id = c.id) then 'owner' end,
        case when t.name is not null then 'technician' end
      ], null) as roles
    from latest l left join public.contacts c on c.wa_id = l.wa_id
    left join lateral (
      select min(display_name) as name from public.technicians
      where wa_id = l.wa_id and active and deleted_at is null
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

create function public.admin_platform_activity(p_from date, p_to date, p_timezone text, p_channel text)
returns jsonb language sql stable security invoker set search_path = public as $$
  with bounds as (
    select p_from::timestamp at time zone p_timezone as start_at,
      (p_to + 1)::timestamp at time zone p_timezone as end_at
  ), received as (
    select e.contact_wa_id as wa_id, (e.received_at at time zone p_timezone)::date as day
    from public.whatsapp_inbox_events e, bounds b
    where e.event_kind = 'message' and e.received_at >= b.start_at and e.received_at < b.end_at
      and (p_channel = 'all' or p_channel = case when e.payload->>'simulated' = 'true' then 'whatsapp_simulator' else 'whatsapp' end)
  ), sent as (
    select (o.sent_at at time zone p_timezone)::date as day
    from public.message_outbox o, bounds b
    where o.sent_at >= b.start_at and o.sent_at < b.end_at
      and (p_channel = 'all' or p_channel = case when o.payload->>'transport' = 'simulator' then 'whatsapp_simulator' else 'whatsapp' end)
  ), usage as (
    select a.*, (a.started_at at time zone p_timezone)::date as day
    from public.ai_usage_events a, bounds b
    where a.started_at >= b.start_at and a.started_at < b.end_at
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

revoke all on function public.admin_whatsapp_threads(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_whatsapp_threads(text, text, text, integer, integer) to service_role;
revoke all on function public.admin_platform_activity(date, date, text, text) from public, anon, authenticated;
grant execute on function public.admin_platform_activity(date, date, text, text) to service_role;
