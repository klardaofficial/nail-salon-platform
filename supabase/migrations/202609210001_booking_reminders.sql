-- BOOK-11: admin-configured booking reminders. Reminder *times* are
-- organization-only (no root default list); the reminder *template* key
-- exists at both root and organization level, mirroring the existing
-- technician confirmed/cancelled template columns and their root-fallback
-- resolution in resolveEffectiveMetaConfiguration().

create table public.booking_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offset_minutes integer not null check (offset_minutes between 60 and 43200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, offset_minutes)
);

comment on column public.booking_reminder_rules.offset_minutes is
  'How long before bookings.starts_at to send the reminder. Always a whole number of hours (60-43200): the admin UI only offers hours/days units. Also the dedup-key component in message_outbox.deduplication_key (booking:{id}:reminder:{offset_minutes}), keyed on the offset rather than this row''s id so deleting and re-adding the same rule can never re-send or double-send.';

create trigger booking_reminder_rules_updated_at before update on public.booking_reminder_rules
for each row execute function public.set_updated_at();

alter table public.booking_reminder_rules enable row level security;
create policy organization_admins_manage_reminder_rules on public.booking_reminder_rules
  for all to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

-- One shared template serves every reminder rule (no template per offset),
-- resolved with the same root-fallback precedence as the technician
-- confirmed/cancelled templates.
alter table public.root_settings add column booking_reminder_template text;
alter table public.organization_provider_settings add column booking_reminder_template text;

-- The reminder scan (src/features/bookings/reminder-delivery.ts) filters by
-- exactly this triple; neither bookings_salon_start_idx nor
-- bookings_organization_created_idx covers it.
create index bookings_organization_status_start_idx on public.bookings (organization_id, status, starts_at);
