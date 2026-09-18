alter table public.organization_provider_settings
  alter column openai_chat_model drop not null,
  alter column openai_chat_model drop default,
  alter column openai_image_model drop not null,
  alter column openai_image_model drop default;
