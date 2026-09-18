-- 202609170005 added organization-scoped composite foreign keys
-- (organization_id, x) alongside the original single-column foreign keys
-- for the same relationship. Having both gives PostgREST two paths between
-- the same table pair, so any embed without an explicit constraint hint
-- fails with "more than one relationship was found". The composite key
-- already enforces the relationship (plus organization scoping) for every
-- existing row, so dropping the redundant single-column key changes no
-- data -- it only removes the duplicate constraint.
alter table public.business_owners drop constraint if exists business_owners_business_id_fkey;
alter table public.business_owners drop constraint if exists business_owners_contact_id_fkey;
alter table public.salons drop constraint if exists salons_business_id_fkey;
alter table public.service_salons drop constraint if exists service_salons_service_id_fkey;
alter table public.service_salons drop constraint if exists service_salons_salon_id_fkey;
alter table public.technicians drop constraint if exists technicians_salon_id_fkey;
alter table public.bookings drop constraint if exists bookings_business_id_fkey;
alter table public.bookings drop constraint if exists bookings_salon_id_fkey;
alter table public.bookings drop constraint if exists bookings_contact_id_fkey;
alter table public.booking_services drop constraint if exists booking_services_booking_id_fkey;
alter table public.booking_services drop constraint if exists booking_services_service_id_fkey;
alter table public.booking_events drop constraint if exists booking_events_booking_id_fkey;
alter table public.conversations drop constraint if exists conversations_contact_id_fkey;
alter table public.conversation_messages drop constraint if exists conversation_messages_conversation_id_fkey;
alter table public.booking_drafts drop constraint if exists booking_drafts_conversation_id_fkey;
alter table public.interactive_prompts drop constraint if exists interactive_prompts_conversation_id_fkey;
alter table public.tool_executions drop constraint if exists tool_executions_conversation_id_fkey;
alter table public.job_outbox drop constraint if exists job_outbox_inbox_event_id_fkey;
alter table public.message_outbox drop constraint if exists message_outbox_conversation_id_fkey;
alter table public.preview_requests drop constraint if exists preview_requests_contact_id_fkey;
alter table public.ai_usage_events drop constraint if exists ai_usage_events_conversation_id_fkey;
alter table public.ai_usage_events drop constraint if exists ai_usage_events_preview_request_id_fkey;
