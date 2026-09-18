-- 202609170003 scoped this unique index to organization_id and added a
-- `where provider_message_id is not null` predicate. A plain unique index
-- already allows multiple NULLs, so the predicate added nothing -- but it
-- makes the index partial, and Postgres cannot use a partial index to
-- satisfy an ON CONFLICT target unless the INSERT carries the same WHERE
-- clause. Supabase's .upsert() never adds one, so every conversation_messages
-- upsert with a non-null provider_message_id (inbound and outbound history)
-- fails with "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Replace it with a plain unique index.
drop index if exists conversation_messages_organization_provider_message_id_key;
create unique index conversation_messages_organization_provider_message_id_key
  on public.conversation_messages (organization_id, provider_message_id);
