-- Services may optionally carry a price and a duration. Both stay nullable
-- with no default: null means "the owner has not set this", while 0 remains a
-- legitimate distinct value (a genuinely free or instant service). Collapsing
-- the two would make "free" and "unknown" indistinguishable to the external
-- booking website and the AI bot (see docs/architecture/data-model.md).
alter table public.services
  add column price numeric(10,2) check (price >= 0),
  add column duration_minutes integer check (duration_minutes between 1 and 1440);

-- Organization-level currency for the price column above. The check here is
-- deliberately permissive (any 3 uppercase letters), matching the
-- bot_locale/languageCodeSchema pattern: the curated, symbol-carrying list
-- lives in application code (src/lib/currencies.ts) and can grow without a
-- migration. create_organization inserts this row with column defaults only,
-- so new organizations get 'EUR' and existing rows backfill from the default.
alter table public.organization_settings
  add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$');
