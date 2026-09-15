# Admin UI conventions

The dashboard is under the English root layout and registers Ant Design styles with `@ant-design/nextjs-registry`. `AdminProviders` sets `en_US`, shared tokens, feedback context, and SWR defaults. Use Ant Design layout, menu, forms, drawers/modals, tables, tags, statistics, skeletons, and alerts before custom controls.

All browser API reads use `useSWR` with stable keys from `lib/api/keys.ts`. Mutations use `useSWRMutation` and `apiMutation`, then invalidate the exact resource keys. Each screen provides loading, error, and empty behavior. The service-role database client must never be imported into a client component.

Resource pages share `ResourceManager`; add fields/columns through `features/admin/resources.ts` and enforce the same schema in `resource-api.ts`. Authentication forms submit to route handlers. The migration-created account has `must_change_password`; the shell disables other navigation and routes it to Account settings until the authenticated password change clears the flag.

Analytics use Ant Design Charts. Charts must have a textual/table equivalent, filters shared with the API/CSV definition, and visible loading/error/empty states. Keep the English dashboard separate from bot i18n and German marketing styles.
