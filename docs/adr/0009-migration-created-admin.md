# ADR 0009: Migration-created admin and Auth-owned passwords

Status: Accepted, 2026-09-15.

The initial migration creates one confirmed Supabase Auth user, `admin@gmail.com`, with the requested initial password `Pass1234`, grants platform-admin membership, and sets `must_change_password=true`. The protected admin shell allows the account settings flow and redirects away from other pages until the password is changed. Later passwords remain in Supabase Auth.

There are no admin credential environment variables or public registration route. The initial password hash is generated during the migration and is not stored in an application table. Applied migrations never rerun during ordinary deployment, so a later password is not reset. Recovery uses protected Supabase Auth operations.

Affected modules: initial migration, login/password routes, admin shell, admin table, deployment/runbook docs.
