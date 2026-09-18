# Admin UI conventions

The dashboard is under the English root layout and registers Ant Design styles with `@ant-design/nextjs-registry`. `AdminProviders` sets `en_US`, shared tokens, feedback context, and SWR defaults. Use Ant Design layout, menu, forms, drawers/modals, tables, tags, statistics, skeletons, and alerts before custom controls.

All browser API reads use `useSWR` with stable keys from `lib/api/keys.ts`. Mutations use `useSWRMutation` and `apiMutation`, then invalidate the exact resource keys. Each screen provides loading, error, and empty behavior. The service-role database client must never be imported into a client component.

The root Overview is the organization directory. Once an organization is selected, Overview stays on that organization's scoped dashboard; the root-only System accounts and Root Meta entries are hidden. Organization lifecycle actions are available from each card's overflow menu and retain a confirmation step.

Salon, service, and technician pages share `ResourceManager`; add fields/columns through `features/admin/resources.ts` and enforce the same schema in `resource-api.ts`. Organization Settings separates organization identity/defaults, WhatsApp, Simulator, and OpenAI into distinct cards. Unconfigured WhatsApp and OpenAI fields stay hidden until an editor opens their configuration switch; either card opens automatically when saved organization-specific values exist. The WhatsApp card also owns provider readiness, webhook URL, validation, real-traffic enablement, and click-to-chat details. There are no legacy top-level resource pages or unscoped admin API shims. Authentication forms submit to route handlers. The migration-created account has `must_change_password`; the shell disables other navigation and routes it to Account settings until the authenticated password change clears the flag.

Time fields use Day.js values inside Ant Design forms. Convert both create defaults and saved API values with the explicitly registered `customParseFormat` plugin, and serialize submitted times as `HH:mm`. Opening a create form after editing restores the resource defaults.

Use current component APIs: `Alert.title`, `Select.showSearch.optionFilterProp`, and Phosphor exports ending in `Icon`. Type-aware ESLint rejects APIs marked `@deprecated` by their declarations.

Overview adds platform activity below booking reporting, using the same calendar dates plus an independent source selector. It includes accessible tables, matching CSV export, and a paginated AI request log. The separate WhatsApp inbox uses responsive list/detail panes and the same `ChatMessageBubble` as the Simulator, with no reply callback or composer. See [observability](../architecture/platform-observability.md).

Analytics use Ant Design Charts. Charts must have a textual/table equivalent, filters shared with the API/CSV definition where applicable, and visible loading/error/empty states. The dashboard has no business filter because each deployment has one configured business. Keep the English dashboard separate from bot i18n and German marketing styles.
