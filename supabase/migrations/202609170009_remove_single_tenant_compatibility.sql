-- Final cutover: organization scope must be supplied explicitly by every writer.

create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_system_admin() then raise exception 'system_admin_required'; end if;
  insert into public.organizations(name) values (btrim(p_name)) returning id into new_id;
  insert into public.businesses (organization_id, name) values (new_id, btrim(p_name));
  insert into public.organization_settings (organization_id) values (new_id);
  insert into public.organization_provider_settings (organization_id) values (new_id);
  return new_id;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'businesses', 'contacts', 'business_owners', 'salons', 'services', 'service_salons',
    'technicians', 'technician_time_off', 'business_customers', 'bookings', 'booking_services',
    'booking_events', 'conversations', 'conversation_messages', 'booking_drafts',
    'interactive_prompts', 'tool_executions', 'whatsapp_inbox_events', 'job_outbox',
    'message_outbox', 'preview_usage', 'preview_requests', 'ai_usage_events', 'audit_log'
  ] loop
    execute format('alter table public.%I alter column organization_id drop default', table_name);
  end loop;
end $$;

drop function if exists public.register_whatsapp_event(text, text, text, jsonb);
drop function if exists public.reserve_preview_request(uuid, uuid, text, date, text, text, integer, integer);
drop function if exists public.complete_preview_request(uuid, jsonb);
drop function if exists public.create_booking_from_conversation(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, text, jsonb);
drop function if exists public.cancel_customer_booking(uuid, uuid, text);
drop function if exists public.reschedule_customer_booking(uuid, uuid, uuid, timestamptz, text, text, uuid, text, text, jsonb, text);
drop function if exists public.get_staff_booking_summary(uuid, text, timestamptz, timestamptz, text);
drop function if exists public.admin_whatsapp_threads(text, text, text, integer, integer);
drop function if exists public.admin_platform_activity(date, date, text, text);
drop view if exists public.admin_whatsapp_messages;
drop policy if exists platform_admin_all on public.platform_admins;
drop policy if exists platform_admin_all on public.platform_settings;
drop policy if exists platform_admin_all on public.audit_log;
drop policy if exists platform_admin_read on public.audit_log;
create policy admin_profile_read on public.platform_admins for select to authenticated
  using (user_id = auth.uid() or public.is_system_admin());
create policy scoped_audit_read on public.audit_log for select to authenticated using (
  (scope_type = 'platform' and public.is_system_admin())
  or (scope_type = 'organization' and public.is_organization_admin(organization_id))
);
drop function if exists public.is_platform_admin();
drop table if exists public.platform_settings;
alter table public.businesses drop column if exists singleton;
drop function public.default_organization_id();
