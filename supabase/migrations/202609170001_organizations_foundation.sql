-- Add the tenant root without discarding the deployed single-business data.  The
-- default_organization_id() default is a temporary compatibility bridge for
-- callers that have not yet been made organization-aware.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  archived_by uuid references public.platform_admins(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null))
);

create trigger organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000101', 'Default organization')
on conflict (id) do nothing;

create function public.default_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.organizations
  where id = '00000000-0000-4000-8000-000000000101'
$$;

alter table public.platform_admins add column if not exists is_system_admin boolean not null default false;
update public.platform_admins set is_system_admin = true
where lower(email) = 'admin@gmail.com';

create table public.organization_admin_memberships (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.platform_admins(user_id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create trigger organization_admin_memberships_updated_at before update on public.organization_admin_memberships
for each row execute function public.set_updated_at();

alter table public.businesses add column if not exists organization_id uuid;
update public.businesses set organization_id = public.default_organization_id() where organization_id is null;
alter table public.businesses alter column organization_id set not null;
alter table public.businesses alter column organization_id set default public.default_organization_id();
alter table public.businesses add constraint businesses_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict;
create unique index businesses_organization_id_key on public.businesses (organization_id);
-- Keep the legacy column for old callers during the rollout, but it can no
-- longer be globally unique once a second organization exists.
drop index if exists public.businesses_singleton_idx;

-- The deterministic business row is the existing customer-facing profile.
update public.organizations o set name = b.name
from public.businesses b
where b.organization_id = o.id and o.id = public.default_organization_id()
  and o.name = 'Default organization';

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  platform_timezone text not null default 'Europe/Berlin',
  default_open_time time not null default '09:00',
  default_close_time time not null default '18:00',
  default_booking_interval_minutes integer not null default 30 check (default_booking_interval_minutes between 5 and 240),
  preview_requests_per_day integer not null default 3 check (preview_requests_per_day between 1 and 100),
  previews_per_request integer not null default 3 check (previews_per_request between 1 and 3),
  bot_locale text not null default 'de' check (char_length(bot_locale) between 2 and 64),
  simulator_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organization_settings_updated_at before update on public.organization_settings
for each row execute function public.set_updated_at();
insert into public.organization_settings (
  organization_id, platform_timezone, default_open_time, default_close_time,
  default_booking_interval_minutes, preview_requests_per_day, previews_per_request
)
select public.default_organization_id(), platform_timezone, default_open_time, default_close_time,
  default_booking_interval_minutes, preview_requests_per_day, previews_per_request
from public.platform_settings where singleton
on conflict (organization_id) do nothing;

create table public.root_meta_settings (
  singleton boolean primary key default true check (singleton),
  access_token text,
  app_secret text,
  webhook_verify_token text,
  technician_booking_confirmed_template text,
  technician_booking_cancelled_template text,
  configuration_version integer not null default 1 check (configuration_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (access_token is null and app_secret is null and webhook_verify_token is null)
    or (length(btrim(access_token)) > 0 and length(btrim(app_secret)) > 0 and length(btrim(webhook_verify_token)) > 0)
  )
);
create trigger root_meta_settings_updated_at before update on public.root_meta_settings
for each row execute function public.set_updated_at();
insert into public.root_meta_settings (singleton, technician_booking_confirmed_template, technician_booking_cancelled_template)
select true, technician_booking_confirmed_template, technician_booking_cancelled_template
from public.platform_settings where singleton
on conflict (singleton) do nothing;

create table public.organization_provider_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  waba_id text,
  phone_number_id text,
  access_token text,
  app_secret text,
  webhook_verify_token text,
  technician_booking_confirmed_template text,
  technician_booking_cancelled_template text,
  openai_api_key text,
  openai_chat_model text not null default 'gpt-5-mini',
  openai_image_model text not null default 'gpt-image-1',
  openai_pricing jsonb not null default '{}'::jsonb,
  real_whatsapp_enabled boolean not null default false,
  display_phone_number text,
  e164_digits text,
  configuration_version integer not null default 1 check (configuration_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (access_token is null and app_secret is null and webhook_verify_token is null)
    or (length(btrim(access_token)) > 0 and length(btrim(app_secret)) > 0 and length(btrim(webhook_verify_token)) > 0)
  ),
  check (e164_digits is null or e164_digits ~ '^[1-9][0-9]{7,14}$')
);
create trigger organization_provider_settings_updated_at before update on public.organization_provider_settings
for each row execute function public.set_updated_at();
insert into public.organization_provider_settings (organization_id)
select id from public.organizations on conflict (organization_id) do nothing;
create unique index organization_provider_settings_waba_id_key
  on public.organization_provider_settings (btrim(waba_id)) where waba_id is not null;
create unique index organization_provider_settings_phone_number_id_key
  on public.organization_provider_settings (btrim(phone_number_id)) where phone_number_id is not null;

create table public.provider_configuration_validations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  configuration_version integer not null,
  status text not null check (status in ('succeeded', 'failed')),
  failure_code text check (failure_code is null or char_length(failure_code) <= 120),
  validated_at timestamptz not null default now()
);

-- Every operational row carries its tenant explicitly.  Defaults preserve the
-- old RPC signatures until their organization-aware replacements are deployed.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'contacts', 'business_owners', 'salons', 'services', 'service_salons', 'technicians',
    'technician_time_off', 'business_customers', 'bookings', 'booking_services', 'booking_events',
    'conversations', 'conversation_messages', 'booking_drafts', 'interactive_prompts', 'tool_executions',
    'whatsapp_inbox_events', 'job_outbox', 'message_outbox', 'preview_usage', 'preview_requests',
    'ai_usage_events', 'audit_log'
  ] loop
    execute format('alter table public.%I add column if not exists organization_id uuid', table_name);
    execute format('update public.%I set organization_id = public.default_organization_id() where organization_id is null', table_name);
    execute format('alter table public.%I alter column organization_id set not null', table_name);
    execute format('alter table public.%I alter column organization_id set default public.default_organization_id()', table_name);
    execute format('alter table public.%I add constraint %I foreign key (organization_id) references public.organizations(id) on delete restrict', table_name, table_name || '_organization_id_fkey');
  end loop;
end $$;

-- Tenant identity and durable-work uniqueness must include organization scope.
alter table public.contacts drop constraint if exists contacts_wa_id_key;
create unique index contacts_organization_wa_id_key on public.contacts (organization_id, wa_id);
alter table public.whatsapp_inbox_events drop constraint if exists whatsapp_inbox_events_provider_event_id_key;
create unique index whatsapp_inbox_events_organization_provider_event_id_key on public.whatsapp_inbox_events (organization_id, provider_event_id);
alter table public.message_outbox drop constraint if exists message_outbox_deduplication_key_key;
create unique index message_outbox_organization_deduplication_key on public.message_outbox (organization_id, deduplication_key);
alter table public.preview_usage drop constraint if exists preview_usage_pkey;
alter table public.preview_usage add primary key (organization_id, contact_id, usage_date);
alter table public.preview_requests drop constraint if exists preview_requests_contact_id_request_key_key;
create unique index preview_requests_organization_contact_request_key on public.preview_requests (organization_id, contact_id, request_key);

alter table public.bookings add column if not exists simulated boolean not null default false;
create function public.prevent_booking_simulated_change() returns trigger language plpgsql set search_path = public as $$
begin
  if new.simulated is distinct from old.simulated then raise exception 'booking_simulated_is_immutable'; end if;
  return new;
end;
$$;
create trigger bookings_simulated_immutable before update on public.bookings
for each row execute function public.prevent_booking_simulated_change();

create index contacts_organization_wa_id_idx on public.contacts (organization_id, wa_id);
create index conversations_organization_contact_channel_idx on public.conversations (organization_id, contact_id, channel);
create index bookings_organization_created_idx on public.bookings (organization_id, created_at desc);
create index whatsapp_inbox_events_organization_received_idx on public.whatsapp_inbox_events (organization_id, received_at desc);
create index job_outbox_organization_pending_idx on public.job_outbox (organization_id, available_at) where state in ('pending', 'failed');
create index message_outbox_organization_pending_idx on public.message_outbox (organization_id, available_at) where state in ('pending', 'failed');

create function public.is_system_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid() and active and is_system_admin)
$$;
create function public.is_organization_admin(p_organization_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_system_admin() or exists (
    select 1 from public.organization_admin_memberships
    where organization_id = p_organization_id and user_id = auth.uid() and active
  )
$$;
revoke all on function public.is_system_admin() from public;
revoke all on function public.is_organization_admin(uuid) from public;
grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_admin_memberships enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_provider_settings enable row level security;
alter table public.root_meta_settings enable row level security;
alter table public.provider_configuration_validations enable row level security;
create policy organization_admins_read_organizations on public.organizations for select to authenticated using (public.is_organization_admin(id));
create policy system_admins_manage_organizations on public.organizations for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());
create policy organization_admins_read_memberships on public.organization_admin_memberships for select to authenticated using (user_id = auth.uid() or public.is_system_admin());
create policy system_admins_manage_memberships on public.organization_admin_memberships for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());
create policy organization_admins_manage_settings on public.organization_settings for all to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy organization_admins_manage_provider_settings on public.organization_provider_settings for all to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));
create policy organization_admins_read_validation on public.provider_configuration_validations for select to authenticated using (public.is_organization_admin(organization_id));
create policy system_admins_manage_validation on public.provider_configuration_validations for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());
create policy system_admins_manage_root_meta on public.root_meta_settings for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());

-- This is intentionally server-only (service_role) and creates all tenant roots
-- atomically for the system account-management flow.
create function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_system_admin() then raise exception 'system_admin_required'; end if;
  insert into public.organizations(name) values (btrim(p_name)) returning id into new_id;
  insert into public.businesses (organization_id, name, singleton) values (new_id, btrim(p_name), true);
  insert into public.organization_settings (organization_id) values (new_id);
  insert into public.organization_provider_settings (organization_id) values (new_id);
  return new_id;
end;
$$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated, service_role;
