alter table public.businesses add constraint businesses_organization_id_id_key unique (organization_id, id);
alter table public.contacts add constraint contacts_organization_id_id_key unique (organization_id, id);
alter table public.salons add constraint salons_organization_id_id_key unique (organization_id, id);
alter table public.services add constraint services_organization_id_id_key unique (organization_id, id);
alter table public.technicians add constraint technicians_organization_id_id_key unique (organization_id, id);
alter table public.bookings add constraint bookings_organization_id_id_key unique (organization_id, id);
alter table public.conversations add constraint conversations_organization_id_id_key unique (organization_id, id);
alter table public.preview_requests add constraint preview_requests_organization_id_id_key unique (organization_id, id);
alter table public.whatsapp_inbox_events add constraint whatsapp_inbox_events_organization_id_id_key unique (organization_id, id);

alter table public.business_owners add constraint business_owners_organization_business_fkey
  foreign key (organization_id, business_id) references public.businesses(organization_id, id);
alter table public.business_owners add constraint business_owners_organization_contact_fkey
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id);
alter table public.salons add constraint salons_organization_business_fkey
  foreign key (organization_id, business_id) references public.businesses(organization_id, id);
alter table public.service_salons add constraint service_salons_organization_service_fkey
  foreign key (organization_id, service_id) references public.services(organization_id, id);
alter table public.service_salons add constraint service_salons_organization_salon_fkey
  foreign key (organization_id, salon_id) references public.salons(organization_id, id);
alter table public.technicians add constraint technicians_organization_salon_fkey
  foreign key (organization_id, salon_id) references public.salons(organization_id, id);
alter table public.bookings add constraint bookings_organization_business_fkey
  foreign key (organization_id, business_id) references public.businesses(organization_id, id);
alter table public.bookings add constraint bookings_organization_salon_fkey
  foreign key (organization_id, salon_id) references public.salons(organization_id, id);
alter table public.bookings add constraint bookings_organization_contact_fkey
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id);
alter table public.booking_services add constraint booking_services_organization_booking_fkey
  foreign key (organization_id, booking_id) references public.bookings(organization_id, id);
alter table public.booking_services add constraint booking_services_organization_service_fkey
  foreign key (organization_id, service_id) references public.services(organization_id, id);
alter table public.booking_events add constraint booking_events_organization_booking_fkey
  foreign key (organization_id, booking_id) references public.bookings(organization_id, id);
alter table public.conversations add constraint conversations_organization_contact_fkey
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id);
alter table public.conversation_messages add constraint conversation_messages_organization_conversation_fkey
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id);
alter table public.booking_drafts add constraint booking_drafts_organization_conversation_fkey
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id);
alter table public.interactive_prompts add constraint interactive_prompts_organization_conversation_fkey
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id);
alter table public.tool_executions add constraint tool_executions_organization_conversation_fkey
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id);
alter table public.job_outbox add constraint job_outbox_organization_inbox_fkey
  foreign key (organization_id, inbox_event_id) references public.whatsapp_inbox_events(organization_id, id);
alter table public.message_outbox add constraint message_outbox_organization_conversation_fkey
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id);
alter table public.preview_requests add constraint preview_requests_organization_contact_fkey
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id);
alter table public.ai_usage_events add constraint ai_usage_events_organization_conversation_fkey
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id);
alter table public.ai_usage_events add constraint ai_usage_events_organization_preview_fkey
  foreign key (organization_id, preview_request_id) references public.preview_requests(organization_id, id);

-- Platform audit events deliberately have no tenant; tenant audit events must have one.
alter table public.audit_log alter column organization_id drop not null;
alter table public.audit_log alter column organization_id drop default;
alter table public.audit_log add column scope_type text not null default 'organization'
  check (scope_type in ('platform', 'organization'));
alter table public.audit_log add constraint audit_log_scope_check check (
  (scope_type = 'platform' and organization_id is null)
  or (scope_type = 'organization' and organization_id is not null)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'businesses', 'contacts', 'business_owners', 'salons', 'services', 'service_salons',
    'technicians', 'technician_time_off', 'business_customers', 'bookings', 'booking_services',
    'booking_events', 'conversations', 'conversation_messages', 'booking_drafts',
    'interactive_prompts', 'tool_executions', 'whatsapp_inbox_events', 'job_outbox',
    'message_outbox', 'preview_usage', 'preview_requests', 'ai_usage_events'
  ] loop
    execute format('drop policy if exists platform_admin_all on public.%I', table_name);
    execute format('drop policy if exists platform_admin_read on public.%I', table_name);
    execute format(
      'create policy organization_admin_all on public.%I for all to authenticated using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id))',
      table_name
    );
  end loop;
end $$;
