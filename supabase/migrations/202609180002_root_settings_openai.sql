alter table public.root_meta_settings rename to root_settings;
alter trigger root_meta_settings_updated_at on public.root_settings
  rename to root_settings_updated_at;
alter policy system_admins_manage_root_meta on public.root_settings
  rename to system_admins_manage_root_settings;

alter table public.root_settings
  add column openai_api_key text,
  add column openai_chat_model text not null default 'gpt-5-mini',
  add column openai_image_model text not null default 'gpt-image-1',
  add column openai_pricing jsonb not null default '{}'::jsonb,
  add column openai_configuration_version integer not null default 1
    check (openai_configuration_version > 0);

do $$
declare
  root_key text;
  key_count integer;
  sole_org_id uuid;
  default_org record;
begin
  select openai_api_key into root_key from public.root_settings where singleton;
  if root_key is not null then
    return;
  end if;

  select count(*) into key_count
  from public.organization_provider_settings
  where openai_api_key is not null and length(btrim(openai_api_key)) > 0;

  if key_count = 0 then
    return;
  end if;

  select organization_id into sole_org_id
  from public.organization_provider_settings
  where openai_api_key is not null and length(btrim(openai_api_key)) > 0;

  if key_count = 1 then
    select * into default_org
    from public.organization_provider_settings
    where organization_id = sole_org_id;

    update public.root_settings
    set openai_api_key = default_org.openai_api_key,
        openai_chat_model = default_org.openai_chat_model,
        openai_image_model = default_org.openai_image_model,
        openai_pricing = default_org.openai_pricing
    where singleton;

    update public.organization_provider_settings
    set openai_api_key = null,
        openai_pricing = '{}'::jsonb,
        openai_configuration_version = openai_configuration_version + 1
    where organization_id = sole_org_id;
  else
    select * into default_org
    from public.organization_provider_settings
    where organization_id = '00000000-0000-4000-8000-000000000101';

    update public.root_settings
    set openai_api_key = default_org.openai_api_key,
        openai_chat_model = default_org.openai_chat_model,
        openai_image_model = default_org.openai_image_model,
        openai_pricing = default_org.openai_pricing
    where singleton;
  end if;
end $$;
