alter table public.conversations drop constraint if exists conversations_contact_id_channel_key;
create unique index conversations_organization_contact_channel_key on public.conversations (organization_id, contact_id, channel);
alter table public.conversation_messages drop constraint if exists conversation_messages_provider_message_id_key;
create unique index conversation_messages_organization_provider_message_id_key
  on public.conversation_messages (organization_id, provider_message_id) where provider_message_id is not null;
alter table public.tool_executions drop constraint if exists tool_executions_conversation_id_tool_call_id_key;
create unique index tool_executions_organization_conversation_call_key on public.tool_executions (organization_id, conversation_id, tool_call_id);
