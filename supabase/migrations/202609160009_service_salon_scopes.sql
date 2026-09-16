-- A service is global when it has no scope rows. Scope rows restrict it to one or more salons.
create table public.service_salons (
  service_id uuid not null references public.services(id) on delete cascade,
  salon_id uuid not null references public.salons(id) on delete cascade,
  primary key (service_id, salon_id)
);

-- Preserve every existing single-salon service as a restricted service before retiring the
-- one-to-one column. New services with no rows in service_salons are available everywhere.
insert into public.service_salons (service_id, salon_id)
select id, salon_id from public.services
on conflict do nothing;

drop index if exists public.services_salon_active_idx;
alter table public.services drop constraint if exists services_salon_id_fkey;
alter table public.services drop column salon_id;

create index service_salons_salon_service_idx on public.service_salons (salon_id, service_id);
create index services_active_idx on public.services (active) where deleted_at is null;

alter table public.service_salons enable row level security;
create policy platform_admin_all on public.service_salons for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

comment on table public.service_salons is
  'Optional service restrictions. No rows means the service is available to all salons.';
