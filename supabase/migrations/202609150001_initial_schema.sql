create extension if not exists pgcrypto;

create type public.booking_status as enum ('confirmed', 'cancelled');
create type public.delivery_state as enum ('pending', 'sending', 'sent', 'failed');
create type public.job_state as enum ('pending', 'dispatched', 'processing', 'completed', 'failed');
create type public.preview_state as enum ('reserved', 'processing', 'ready', 'partially_ready', 'delivered', 'failed', 'released');
create type public.message_direction as enum ('inbound', 'outbound');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index platform_admins_email_lower_idx on public.platform_admins (lower(email));

do $$
declare
  admin_user_id uuid;
begin
  select id into admin_user_id from auth.users where lower(email) = 'admin@gmail.com' limit 1;

  if admin_user_id is null then
    admin_user_id := '00000000-0000-4000-8000-000000000001';
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id,
      'authenticated',
      'authenticated',
      'admin@gmail.com',
      crypt('Pass1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  end if;

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  select
    '00000000-0000-4000-8000-000000000002',
    admin_user_id::text,
    admin_user_id,
    jsonb_build_object('sub', admin_user_id::text, 'email', 'admin@gmail.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  where not exists (
    select 1 from auth.identities where user_id = admin_user_id and provider = 'email'
  );

  insert into public.platform_admins (user_id, email, must_change_password)
  values (admin_user_id, 'admin@gmail.com', true)
  on conflict (user_id) do update
  set email = excluded.email;
end;
$$;

create table public.platform_settings (
  singleton boolean primary key default true check (singleton),
  platform_timezone text not null default 'Europe/Berlin',
  default_open_time time not null default '09:00',
  default_close_time time not null default '18:00',
  default_booking_interval_minutes integer not null default 30 check (default_booking_interval_minutes between 5 and 240),
  preview_requests_per_day integer not null default 3 check (preview_requests_per_day between 1 and 100),
  previews_per_request integer not null default 3 check (previews_per_request between 1 and 3),
  greeting_en text not null default 'Hello! How can I help you today?',
  greeting_de text not null default 'Hallo! Wie kann ich dir heute helfen?',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (singleton) values (true);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  reporting_timezone text not null default 'Europe/Berlin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  normalized_phone text,
  display_name text,
  profile_avatar_url text,
  first_contact_at timestamptz not null default now(),
  last_contact_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_owners (
  business_id uuid not null references public.businesses(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, contact_id)
);

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  location_label text not null check (char_length(location_label) between 1 and 300),
  timezone text not null default 'Europe/Berlin',
  default_open_time time not null default '09:00',
  default_close_time time not null default '18:00',
  booking_interval_minutes integer not null default 30 check (booking_interval_minutes between 5 and 240),
  weekly_hours jsonb not null default '{}'::jsonb,
  customer_can_choose_technician boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  wa_id text not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (salon_id, wa_id)
);

create table public.technician_time_off (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.business_customers (
  business_id uuid not null references public.businesses(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  first_booking_at timestamptz,
  last_booking_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, contact_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  salon_id uuid not null references public.salons(id),
  contact_id uuid not null references public.contacts(id),
  starts_at timestamptz not null,
  timezone_snapshot text not null,
  local_time_label text not null,
  status public.booking_status not null default 'confirmed',
  technician_ref uuid,
  technician_name_snapshot text,
  additional_request text,
  source text not null default 'whatsapp',
  idempotency_key text not null unique,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'cancelled' and cancelled_at is not null) or status = 'confirmed')
);

comment on column public.bookings.technician_ref is
  'Soft technician reference by design. It may be null or point to a deleted/missing record.';

create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null,
  actor_contact_id uuid references public.contacts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null default 'whatsapp',
  role_context text not null default 'customer',
  business_context_id uuid references public.businesses(id) on delete set null,
  salon_context_id uuid references public.salons(id) on delete set null,
  summary text,
  greeted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, channel)
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction public.message_direction not null,
  message_type text not null,
  provider_message_id text unique,
  text_content text,
  media_id text,
  structured_content jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.conversation_messages.media_id is
  'WhatsApp media identifier only. Application storage must never contain customer image bytes.';

create table public.booking_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  revision integer not null default 1,
  salon_id uuid references public.salons(id) on delete set null,
  starts_at timestamptz,
  timezone text,
  service_selections jsonb not null default '[]'::jsonb,
  technician_ref uuid,
  additional_request text,
  state text not null default 'collecting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interactive_prompts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  prompt_token text not null unique,
  prompt_type text not null,
  options jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tool_call_id text not null,
  tool_name text not null,
  arguments jsonb not null,
  result jsonb,
  state text not null default 'started',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (conversation_id, tool_call_id)
);

create table public.whatsapp_inbox_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_kind text not null,
  contact_wa_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_code text
);

create table public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  inbox_event_id uuid references public.whatsapp_inbox_events(id) on delete cascade,
  job_name text not null,
  payload jsonb not null,
  state public.job_state not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inbox_event_id, job_name)
);

create table public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  recipient_wa_id text not null,
  message_kind text not null,
  payload jsonb not null,
  deduplication_key text not null unique,
  provider_message_id text,
  state public.delivery_state not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.preview_usage (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  usage_date date not null,
  reserved_count integer not null default 0 check (reserved_count >= 0),
  consumed_count integer not null default 0 check (consumed_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (contact_id, usage_date)
);

create table public.preview_requests (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  request_key text not null,
  usage_date date not null,
  source_media_id text not null,
  style_request text,
  output_media_ids jsonb not null default '[]'::jsonb,
  state public.preview_state not null default 'reserved',
  requested_count integer not null default 3 check (requested_count between 1 and 3),
  generated_count integer not null default 0 check (generated_count between 0 and 3),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, request_key)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_type text not null,
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index salons_business_active_idx on public.salons (business_id, active) where deleted_at is null;
create index services_salon_active_idx on public.services (salon_id, active) where deleted_at is null;
create index technicians_salon_active_idx on public.technicians (salon_id, active) where deleted_at is null;
create index technician_time_off_range_idx on public.technician_time_off (technician_id, starts_at, ends_at);
create index bookings_business_created_idx on public.bookings (business_id, created_at desc);
create index bookings_salon_start_idx on public.bookings (salon_id, starts_at);
create index bookings_contact_created_idx on public.bookings (contact_id, created_at desc);
create index bookings_technician_start_idx on public.bookings (technician_ref, starts_at) where technician_ref is not null;
create index conversation_messages_recent_idx on public.conversation_messages (conversation_id, created_at desc);
create index inbox_unprocessed_idx on public.whatsapp_inbox_events (received_at) where processed_at is null;
create index job_outbox_pending_idx on public.job_outbox (available_at) where state in ('pending', 'failed');
create index message_outbox_pending_idx on public.message_outbox (available_at) where state in ('pending', 'failed');
create index previews_contact_date_idx on public.preview_requests (contact_id, usage_date);

create trigger platform_admins_updated_at before update on public.platform_admins
for each row execute function public.set_updated_at();
create trigger platform_settings_updated_at before update on public.platform_settings
for each row execute function public.set_updated_at();
create trigger businesses_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts
for each row execute function public.set_updated_at();
create trigger salons_updated_at before update on public.salons
for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger technicians_updated_at before update on public.technicians
for each row execute function public.set_updated_at();
create trigger technician_time_off_updated_at before update on public.technician_time_off
for each row execute function public.set_updated_at();
create trigger business_customers_updated_at before update on public.business_customers
for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger booking_drafts_updated_at before update on public.booking_drafts
for each row execute function public.set_updated_at();
create trigger job_outbox_updated_at before update on public.job_outbox
for each row execute function public.set_updated_at();
create trigger message_outbox_updated_at before update on public.message_outbox
for each row execute function public.set_updated_at();
create trigger previews_updated_at before update on public.preview_requests
for each row execute function public.set_updated_at();

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'platform_admins', 'platform_settings', 'businesses',
    'contacts', 'business_owners', 'salons', 'services', 'technicians',
    'technician_time_off', 'business_customers', 'bookings', 'booking_services',
    'booking_events', 'conversations', 'conversation_messages', 'booking_drafts',
    'interactive_prompts', 'tool_executions', 'whatsapp_inbox_events', 'job_outbox',
    'message_outbox', 'preview_usage', 'preview_requests', 'audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy platform_admin_all on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',
      table_name
    );
  end loop;
end;
$$;

create function public.register_whatsapp_event(
  p_provider_event_id text,
  p_event_kind text,
  p_contact_wa_id text,
  p_payload jsonb
)
returns table (accepted boolean, inbox_event_id uuid, job_outbox_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event_id uuid;
  inserted_job_id uuid;
begin
  insert into public.whatsapp_inbox_events (
    provider_event_id, event_kind, contact_wa_id, payload
  ) values (
    p_provider_event_id, p_event_kind, p_contact_wa_id, p_payload
  )
  on conflict (provider_event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    select id into inserted_event_id
    from public.whatsapp_inbox_events
    where provider_event_id = p_provider_event_id;
    return query select false, inserted_event_id, null::uuid;
    return;
  end if;

  insert into public.job_outbox (inbox_event_id, job_name, payload)
  values (
    inserted_event_id,
    'whatsapp/process-event',
    jsonb_build_object('inboxEventId', inserted_event_id)
  )
  returning id into inserted_job_id;

  return query select true, inserted_event_id, inserted_job_id;
end;
$$;

revoke all on function public.register_whatsapp_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.register_whatsapp_event(text, text, text, jsonb) to service_role;

create function public.reserve_preview_request(
  p_contact_id uuid,
  p_conversation_id uuid,
  p_request_key text,
  p_usage_date date,
  p_source_media_id text,
  p_style_request text,
  p_requested_count integer,
  p_daily_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  usage_row public.preview_usage%rowtype;
  request_id uuid;
begin
  select id into existing_id
  from public.preview_requests
  where contact_id = p_contact_id and request_key = p_request_key;
  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.preview_usage (contact_id, usage_date)
  values (p_contact_id, p_usage_date)
  on conflict (contact_id, usage_date) do nothing;

  select * into usage_row
  from public.preview_usage
  where contact_id = p_contact_id and usage_date = p_usage_date
  for update;

  if usage_row.reserved_count + usage_row.consumed_count >= p_daily_limit then
    raise exception using errcode = 'P0001', message = 'preview_quota_exceeded';
  end if;

  update public.preview_usage
  set reserved_count = reserved_count + 1, updated_at = now()
  where contact_id = p_contact_id and usage_date = p_usage_date;

  insert into public.preview_requests (
    contact_id, conversation_id, request_key, usage_date, source_media_id,
    style_request, requested_count
  ) values (
    p_contact_id, p_conversation_id, p_request_key, p_usage_date, p_source_media_id,
    p_style_request, least(greatest(p_requested_count, 1), 3)
  )
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.reserve_preview_request(uuid, uuid, text, date, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_preview_request(uuid, uuid, text, date, text, text, integer, integer) to service_role;

create function public.complete_preview_request(
  p_request_id uuid,
  p_output_media_ids jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  preview public.preview_requests%rowtype;
  output_count integer;
begin
  select * into preview from public.preview_requests where id = p_request_id for update;
  if not found or preview.state in ('delivered', 'failed', 'released') then
    return;
  end if;

  output_count := jsonb_array_length(coalesce(p_output_media_ids, '[]'::jsonb));
  if output_count = 0 then
    update public.preview_requests set state = 'failed', failure_code = 'no_output' where id = p_request_id;
    update public.preview_usage
    set reserved_count = greatest(reserved_count - 1, 0), updated_at = now()
    where contact_id = preview.contact_id and usage_date = preview.usage_date;
    return;
  end if;

  update public.preview_requests
  set output_media_ids = p_output_media_ids,
      generated_count = least(output_count, 3),
      state = case when output_count >= requested_count then 'ready'::public.preview_state else 'partially_ready'::public.preview_state end
  where id = p_request_id;

  update public.preview_usage
  set reserved_count = greatest(reserved_count - 1, 0),
      consumed_count = consumed_count + 1,
      updated_at = now()
  where contact_id = preview.contact_id and usage_date = preview.usage_date;
end;
$$;

revoke all on function public.complete_preview_request(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_preview_request(uuid, jsonb) to service_role;

create function public.create_booking_from_conversation(
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
  was_inserted boolean;
begin
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
  returning id, true into booking_id, was_inserted;

  if booking_id is null then
    select id into booking_id from public.bookings where idempotency_key = p_idempotency_key;
    return booking_id;
  end if;

  insert into public.booking_services (booking_id, service_id, service_name_snapshot, position)
  select
    booking_id,
    nullif(item->>'serviceId', '')::uuid,
    item->>'name',
    (ordinality - 1)::integer
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

create function public.cancel_customer_booking(
  p_booking_id uuid,
  p_contact_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_id uuid;
begin
  update public.bookings
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
  where id = p_booking_id
    and contact_id = p_contact_id
    and status = 'confirmed'
    and starts_at > now()
  returning id into changed_id;

  if changed_id is null then
    return false;
  end if;

  insert into public.booking_events (booking_id, event_type, actor_contact_id)
  values (changed_id, 'booking.cancelled', p_contact_id);
  return true;
end;
$$;

revoke all on function public.cancel_customer_booking(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_customer_booking(uuid, uuid, text) to service_role;
