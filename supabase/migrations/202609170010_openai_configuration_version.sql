alter table public.organization_provider_settings
  add column openai_configuration_version integer not null default 1
  check (openai_configuration_version > 0);
