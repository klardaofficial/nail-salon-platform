-- Follow-up to flexible conversations: language codes are not restricted to English/German.
alter table public.conversations drop constraint conversations_reply_locale_check;
alter table public.conversations
  add constraint conversations_reply_locale_check
    check (reply_locale is null or char_length(reply_locale) between 2 and 64),
  add column reply_unavailable_text text;

comment on column public.conversations.reply_locale is
  'Canonical language tag chosen from customer language or BOT_LOCALE as the initial reference.';
comment on column public.conversations.reply_unavailable_text is
  'AI-generated brief unavailable reply in the latest conversation language, for provider outages.';
