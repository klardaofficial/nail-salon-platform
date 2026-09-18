import type { ActivityChannel } from "@/features/analytics/platform-types";
import type { InboxChannel, InboxRole } from "@/features/inbox/contracts";

export type ApiKey = readonly [scope: string, url: string, ...dependencies: unknown[]];

export const apiKey = (scope: string, url: string, ...dependencies: unknown[]): ApiKey =>
  [scope, url, ...dependencies] as const;

const activityParams = (from: string, to: string, channel: ActivityChannel) =>
  new URLSearchParams({ from, to, channel }).toString();

export const apiKeys = {
  adminIdentity: apiKey("admin-identity", "/api/admin/auth/me"),
  systemSettings: apiKey("system-settings", "/api/admin/system/settings"),
  organizations: apiKey("organizations", "/api/admin/organizations?limit=500"),
  organizationSettings: (organizationId: string) =>
    apiKey(
      "organization-settings",
      `/api/admin/organizations/${organizationId}/settings`,
      organizationId,
    ),
  platform: (organizationId: string, from: string, to: string, channel: ActivityChannel) =>
    apiKey(
      "platform-activity",
      `/api/admin/organizations/${organizationId}/platform?${activityParams(from, to, channel)}`,
      organizationId,
      from,
      to,
      channel,
    ),
  platformCsv: (organizationId: string, from: string, to: string, channel: ActivityChannel) =>
    `/api/admin/organizations/${organizationId}/reports/platform.csv?${activityParams(from, to, channel)}`,
  aiUsage: (
    organizationId: string,
    from: string,
    to: string,
    channel: ActivityChannel,
    page: number,
    kind: string,
  ) =>
    apiKey(
      "ai-usage",
      `/api/admin/organizations/${organizationId}/ai-usage?${activityParams(from, to, channel)}&page=${page}&kind=${encodeURIComponent(kind)}`,
      organizationId,
      from,
      to,
      channel,
      page,
      kind,
    ),
  inbox: (
    organizationId: string,
    channel: InboxChannel,
    search: string,
    role: InboxRole,
    page: number,
  ) =>
    apiKey(
      "inbox",
      `/api/admin/organizations/${organizationId}/inbox?${new URLSearchParams({ channel, search, role, page: String(page) })}`,
      organizationId,
      channel,
      search,
      role,
      page,
    ),
  inboxMessages: (
    organizationId: string,
    channel: InboxChannel,
    waId: string,
    cursor?: string | null,
  ) =>
    apiKey(
      "inbox-messages",
      `/api/admin/organizations/${organizationId}/inbox/messages?${new URLSearchParams({ channel, waId, ...(cursor ? { cursor } : {}) })}`,
      organizationId,
      channel,
      waId,
      cursor,
    ),
  dashboard: (organizationId: string, from: string, to: string, source: string) =>
    apiKey(
      "organization-dashboard",
      `/api/admin/organizations/${organizationId}/dashboard?${new URLSearchParams({ from, to, source })}`,
      organizationId,
      from,
      to,
      source,
    ),
} as const;
