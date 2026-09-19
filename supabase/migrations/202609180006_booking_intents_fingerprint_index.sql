-- Enforces the reuse-or-insert dedup for booking_intents: at most one
-- unconsumed intent per (organization, params_fingerprint) at a time. Partial
-- so consumed/expired history never blocks a fresh intent for the same
-- selections later. Deliberately not paired with .upsert()/ON CONFLICT --
-- 202609180004_fix_conversation_messages_conflict_index.sql documents why
-- Postgres cannot use a partial index as an ON CONFLICT target unless the
-- INSERT carries the same WHERE clause, which Supabase's client never adds.
-- The application inserts plainly and re-selects the existing row on the
-- resulting 23505 violation.
create unique index booking_intents_organization_fingerprint_unconsumed_key
  on public.booking_intents (organization_id, params_fingerprint)
  where consumed_at is null;
