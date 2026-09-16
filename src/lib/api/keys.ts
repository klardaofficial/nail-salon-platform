import type { ActivityChannel } from "@/features/analytics/platform-types";
import type { InboxChannel, InboxRole } from "@/features/inbox/contracts";

const activityParams = (from: string, to: string, channel: ActivityChannel) =>
  new URLSearchParams({ from, to, channel }).toString();

export const apiKeys = {
  platform: (from: string, to: string, channel: ActivityChannel) =>
    `/api/admin/platform?${activityParams(from, to, channel)}`,
  platformCsv: (from: string, to: string, channel: ActivityChannel) =>
    `/api/admin/reports/platform.csv?${activityParams(from, to, channel)}`,
  aiUsage: (from: string, to: string, channel: ActivityChannel, page: number, kind: string) =>
    `/api/admin/ai-usage?${activityParams(from, to, channel)}&page=${page}&kind=${encodeURIComponent(kind)}`,
  inbox: (channel: InboxChannel, search: string, role: InboxRole, page: number) =>
    `/api/admin/inbox?${new URLSearchParams({ channel, search, role, page: String(page) })}`,
  inboxMessages: (channel: InboxChannel, waId: string, cursor?: string | null) =>
    `/api/admin/inbox/messages?${new URLSearchParams({ channel, waId, ...(cursor ? { cursor } : {}) })}`,
  dashboard: (from: string, to: string) =>
    `/api/admin/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  businesses: "/api/admin/businesses",
  salons: "/api/admin/salons",
  services: "/api/admin/services",
  technicians: "/api/admin/technicians",
  settings: "/api/admin/settings",
  simulatorActors: "/api/admin/simulator/actors",
  simulatorSend: "/api/admin/simulator/messages",
  simulatorMessages: (waId: string) =>
    `/api/admin/simulator/messages?waId=${encodeURIComponent(waId)}`,
} as const;
