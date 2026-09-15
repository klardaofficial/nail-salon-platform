import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("./202609150001_initial_schema.sql", import.meta.url)),
  "utf8",
);

describe("initial database contract", () => {
  it("keeps images outside PostgreSQL and stores provider media IDs", () => {
    expect(migration).not.toMatch(/\bbytea\b/i);
    expect(migration).toContain("source_media_id text not null");
    expect(migration).toContain("output_media_ids jsonb");
  });

  it("makes technician assignment a nullable soft reference", () => {
    expect(migration).toContain("technician_ref uuid,");
    expect(migration).not.toMatch(/technician_ref uuid references/i);
  });

  it("enables RLS and provides idempotent booking and inbound operations", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("p_provider_event_id text");
    expect(migration).toContain("on conflict (provider_event_id) do nothing");
    expect(migration).toContain("p_idempotency_key text");
    expect(migration).toContain("on conflict (idempotency_key) do nothing");
  });
});
