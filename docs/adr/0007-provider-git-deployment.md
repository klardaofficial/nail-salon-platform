# ADR 0007: Provider Git integrations and compatible migrations

Status: Accepted, 2026-09-15.

Vercel's GitHub integration deploys Next.js. Supabase Branching's GitHub integration checks preview branches and applies production migrations when enabled. GitHub Actions validates code and a fresh database but does not deploy either provider.

Custom deploy workflows were removed at the user's direction. Because both provider integrations react independently, migrations must be backward compatible and breaking changes use expand/migrate/contract releases. Supabase checks are required before merge.

Affected modules: `.github/workflows/quality.yml`, `supabase/`, production deployment guide.
