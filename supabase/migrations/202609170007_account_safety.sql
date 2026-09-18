create function public.set_system_admin_role(p_user_id uuid, p_is_system_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare current_value boolean;
begin
  if not public.is_system_admin() then raise exception 'system_admin_required'; end if;
  lock table public.platform_admins in share row exclusive mode;
  select is_system_admin into current_value from public.platform_admins
  where user_id = p_user_id and active for update;
  if not found then raise exception 'admin_not_found'; end if;
  if current_value and not p_is_system_admin and
    (select count(*) from public.platform_admins where active and is_system_admin) <= 1
    then raise exception 'last_system_admin_protected'; end if;
  update public.platform_admins set is_system_admin = p_is_system_admin where user_id = p_user_id;
end;
$$;

create function public.deactivate_platform_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target public.platform_admins%rowtype;
begin
  if not public.is_system_admin() then raise exception 'system_admin_required'; end if;
  lock table public.platform_admins in share row exclusive mode;
  select * into target from public.platform_admins where user_id = p_user_id for update;
  if not found then raise exception 'admin_not_found'; end if;
  if target.active and target.is_system_admin and
    (select count(*) from public.platform_admins where active and is_system_admin) <= 1
    then raise exception 'last_system_admin_protected'; end if;
  update public.platform_admins set active = false, is_system_admin = false where user_id = p_user_id;
  update public.organization_admin_memberships set active = false where user_id = p_user_id;
end;
$$;

revoke all on function public.set_system_admin_role(uuid, boolean) from public, anon;
revoke all on function public.deactivate_platform_admin(uuid) from public, anon;
grant execute on function public.set_system_admin_role(uuid, boolean) to authenticated, service_role;
grant execute on function public.deactivate_platform_admin(uuid) to authenticated, service_role;
