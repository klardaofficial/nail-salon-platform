import type { ActivityChannel } from "@/features/analytics/platform-types";
import type { InboxChannel, InboxRole } from "@/features/inbox/contracts";

const activityParams = (from: string, to: string, channel: ActivityChannel) =>
  new URLSearchParams({ from, to, channel }).toString();

export const apiKeys = {
  adminIdentity: "/api/admin/auth/me",
  organizations: "/api/admin/organizations?limit=500",
  organizationSettings: (organizationId: string) =>
    `/api/admin/organizations/${organizationId}/settings`,
  platform: (organizationId: string, from: string, to: string, channel: ActivityChannel) =>
    `/api/admin/organizations/${organizationId}/platform?${activityParams(from, to, channel)}`,
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
    `/api/admin/organizations/${organizationId}/ai-usage?${activityParams(from, to, channel)}&page=${page}&kind=${encodeURIComponent(kind)}`,
  inbox: (
    organizationId: string,
    channel: InboxChannel,
    search: string,
    role: InboxRole,
    page: number,
  ) =>
    `/api/admin/organizations/${organizationId}/inbox?${new URLSearchParams({ channel, search, role, page: String(page) })}`,
  inboxMessages: (
    organizationId: string,
    channel: InboxChannel,
    waId: string,
    cursor?: string | null,
  ) =>
    `/api/admin/organizations/${organizationId}/inbox/messages?${new URLSearchParams({ channel, waId, ...(cursor ? { cursor } : {}) })}`,
  dashboard: (organizationId: string, from: string, to: string, source: string) =>
    `/api/admin/organizations/${organizationId}/dashboard?${new URLSearchParams({ from, to, source })}`,
} as const;
