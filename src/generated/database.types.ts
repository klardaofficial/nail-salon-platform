// Replace with `pnpm db:types` after applying local migrations.
// Application repositories intentionally avoid relying on stale generated declarations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
