-- Booking intents let a separate, external booking website hand a customer off
-- to WhatsApp with their selections already made. The public callback endpoint
-- persists one row per distinct request, then redirects to a wa.me link whose
-- prefilled text carries this row's code. The inbound WhatsApp pipeline claims
-- the row exactly once and seeds booking_drafts with the exact catalog UUIDs
-- the website chose, instead of re-deriving them from free text.
create table public.booking_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9]{8,16}$'),
  salon_id uuid not null,
  starts_at timestamptz not null,
  service_selections jsonb not null default '[]'::jsonb,
  technician_ref uuid,
  additional_request text,
  locale text not null check (char_length(locale) between 2 and 64),
  message_text text,
  message_source text not null check (message_source in ('ai', 'template')),
  params_fingerprint text not null,
  consumed_at timestamptz,
  consumed_conversation_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consumed_at is null or consumed_conversation_id is not null)
);

alter table public.booking_intents add constraint booking_intents_organization_salon_fkey
  foreign key (organization_id, salon_id) references public.salons(organization_id, id);
alter table public.booking_intents add constraint booking_intents_organization_conversation_fkey
  foreign key (organization_id, consumed_conversation_id) references public.conversations(organization_id, id);

comment on column public.booking_intents.code is
  'Per-organization bearer token embedded in the WhatsApp prefill text. Holding it is sufficient to claim the intent; it carries no customer identity.';
comment on column public.booking_intents.technician_ref is
  'Snapshot reference only, deliberately without a foreign key, mirroring booking_drafts.technician_ref and bookings.technician_ref.';
comment on column public.booking_intents.starts_at is
  'Already resolved to an instant (UTC) from the external site''s naive local time using organization_settings.platform_timezone at creation time.';

create unique index booking_intents_organization_code_key on public.booking_intents (organization_id, code);
create index booking_intents_organization_fingerprint_idx on public.booking_intents (organization_id, params_fingerprint);
create index booking_intents_expires_at_idx on public.booking_intents (expires_at);

create trigger booking_intents_updated_at before update on public.booking_intents
for each row execute function public.set_updated_at();

alter table public.booking_intents enable row level security;
create policy organization_admins_manage_booking_intents on public.booking_intents
  for all to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

-- Marks a booking_drafts row seeded from the external booking site rather than
-- collected conversationally. Null means the existing conversation-originated
-- behavior (all rows before this migration, and every draft the bot builds up
-- through chat). Surfaces in the LLM prompt via the existing draft.data spread.
alter table public.booking_drafts add column origin text
  check (origin in ('conversation', 'external_site'));
