-- Admin route handlers authenticate the browser session before using the
-- service-role database client. Permit that trusted server invocation while
-- retaining the system-admin check for any direct authenticated invocation.
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_system_admin() then
    raise exception 'system_admin_required';
  end if;
  insert into public.organizations(name) values (btrim(p_name)) returning id into new_id;
  insert into public.businesses (organization_id, name) values (new_id, btrim(p_name));
  insert into public.organization_settings (organization_id) values (new_id);
  insert into public.organization_provider_settings (organization_id) values (new_id);
  return new_id;
end;
$$;
