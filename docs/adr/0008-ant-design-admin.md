# ADR 0008: Ant Design admin and charts

Status: Accepted, 2026-09-15.

The admin dashboard uses Ant Design with English locale and Ant Design Charts. Shared resource forms/tables and theme tokens keep administrative UX consistent. Browser reads and mutations use SWR route APIs with explicit states and targeted invalidation.

A custom component system was rejected because it increases maintenance effort. Charts always retain a textual/table equivalent and share metric definitions with exports.

Affected modules: admin providers/shell/components, admin APIs, analytics types/calculator.

2026-09-16 extension: platform activity shares the Overview dates and provides chart/table/CSV equivalents with a source selector. The read-only inbox reuses the Simulator's message bubble component, with interactive behavior enabled only through an explicit callback supplied by the Simulator.
