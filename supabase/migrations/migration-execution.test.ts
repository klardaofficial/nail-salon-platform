import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("./202609150001_initial_schema.sql", import.meta.url)),
  "utf8",
);

const database = new PGlite({ extensions: { pgcrypto } });

describe("migration execution", () => {
  beforeAll(async () => {
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (
        instance_id uuid,
        id uuid primary key,
        aud text,
        role text,
        email text unique,
        encrypted_password text,
        email_confirmed_at timestamptz,
        raw_app_meta_data jsonb,
        raw_user_meta_data jsonb,
        created_at timestamptz,
        updated_at timestamptz,
        confirmation_token text,
        recovery_token text,
        email_change_token_new text,
        email_change text
      );
      create table auth.identities (
        id uuid primary key,
        provider_id text not null,
        user_id uuid not null references auth.users(id),
        identity_data jsonb not null,
        provider text not null,
        last_sign_in_at timestamptz,
        created_at timestamptz,
        updated_at timestamptz,
        unique (provider_id, provider)
      );
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    await database.exec(migration);
  }, 30_000);

  afterAll(async () => database.close());

  it("creates the core durable and business tables", async () => {
    const result = await database.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('bookings', 'whatsapp_inbox_events', 'message_outbox', 'preview_requests')
      order by table_name
    `);
    expect(result.rows.map((row) => row.table_name)).toEqual([
      "bookings",
      "message_outbox",
      "preview_requests",
      "whatsapp_inbox_events",
    ]);
  });

  it("enables row-level security on private tables", async () => {
    const result = await database.query<{ relrowsecurity: boolean }>(`
      select relrowsecurity from pg_class where oid = 'public.bookings'::regclass
    `);
    expect(result.rows[0]?.relrowsecurity).toBe(true);
  });

  it("creates the initial admin and requires a password change", async () => {
    const result = await database.query<{
      email: string;
      must_change_password: boolean;
      password_matches: boolean;
    }>(`
      select
        pa.email,
        pa.must_change_password,
        (u.encrypted_password = crypt('Pass1234', u.encrypted_password)) as password_matches
      from public.platform_admins pa
      join auth.users u on u.id = pa.user_id
    `);
    expect(result.rows).toEqual([
      { email: "admin@gmail.com", must_change_password: true, password_matches: true },
    ]);
  });

  it("leaves all salon and customer data empty", async () => {
    const result = await database.query<{ record_count: number }>(`
      select count(*)::integer as record_count
      from (
        select id from public.businesses
        union all select id from public.salons
        union all select id from public.services
        union all select id from public.technicians
        union all select id from public.contacts
        union all select id from public.bookings
        union all select id from public.conversations
      ) business_data
    `);
    expect(result.rows[0]?.record_count).toBe(0);
  });
});
