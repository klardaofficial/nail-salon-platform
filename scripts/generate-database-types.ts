import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Capture output before replacing the file: a failed CLI run must not truncate it.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const generated = spawnSync(
  process.execPath,
  [resolve("node_modules/supabase/dist/supabase.js"), "gen", "types", "typescript", "--local"],
  {
    encoding: "utf8",
    env: { ...process.env, DO_NOT_TRACK: "1" },
    maxBuffer: 10 * 1024 * 1024,
  },
);

let types = generated.status === 0 ? generated.stdout : "";
if (!types.includes("export type Database =")) {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error(
      "Local type generation failed. Start local Supabase and configure its local URL and service-role key. The existing types were preserved.",
    );
  // The already-running local metadata service can generate the same schema types
  // when the caller cannot manage Docker containers through the CLI.
  console.error("Using the running local Supabase metadata service for type generation.");
  url.pathname = "/pg/generators/typescript";
  url.search = new URLSearchParams({
    included_schemas: "public,graphql_public",
    detect_one_to_one_relationships: "true",
  }).toString();
  const response = await fetch(url, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Local metadata generation failed (${response.status}). The existing types were preserved.`,
    );
  types = await response.text();
}
if (!types.includes("export type Database ="))
  throw new Error("Invalid generated types. The existing file was preserved.");
const target = resolve("src/generated/database.types.ts");
const temporary = `${target}.tmp`;
writeFileSync(temporary, types, "utf8");
renameSync(temporary, target);
console.error("Generated src/generated/database.types.ts from the local database.");
