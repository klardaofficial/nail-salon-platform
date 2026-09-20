-- Lets an organization turn conversational AI off entirely and fall back to a
-- deterministic, per-language scripted flow (see src/lib/bot/static-messages.ts
-- and src/features/conversation/scripted-flow.ts). Existing organizations are
-- unaffected: the default keeps today's AI-driven behavior.
alter table public.organization_settings
  add column ai_bot_enabled boolean not null default true,
  add column external_website_url text
    check (external_website_url is null or external_website_url ~ '^https?://[^[:space:]]+$');

comment on column public.organization_settings.ai_bot_enabled is
  'When false, the WhatsApp pipeline replies from static per-language copy instead of calling OpenAI, and skips owner/technician message processing entirely. Confirm/cancel technician notifications still send.';
comment on column public.organization_settings.external_website_url is
  'Optional external booking website shown to customers in scripted replies. Null falls back to the deployment root URL (APP_URL).';
