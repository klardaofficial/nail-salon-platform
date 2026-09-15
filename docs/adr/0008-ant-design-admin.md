# ADR 0008: Ant Design admin and charts

Status: Accepted, 2026-09-15.

The admin dashboard uses Ant Design with English locale and Ant Design Charts. Shared resource forms/tables and theme tokens keep administrative UX consistent. Browser reads and mutations use SWR route APIs with explicit states and targeted invalidation.

A custom component system was rejected because it increases maintenance effort. Charts always retain a textual/table equivalent and share metric definitions with exports.

Affected modules: admin providers/shell/components, admin APIs, analytics types/calculator.
