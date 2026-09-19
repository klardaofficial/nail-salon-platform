-- salonId is optional on the public booking-intent endpoint: an organization
-- with zero active salons has no salon to record, and one with exactly one
-- active salon does not need the external site to send it (mirroring
-- create_organization_booking's own salon_id nullability -- see AGENTS.md
-- "A booking needs an active business and future time... With no active
-- salons, salon is null... a sole active salon is implicit").
alter table public.booking_intents alter column salon_id drop not null;
