export const apiKeys = {
  dashboard: (days: number, businessId?: string) =>
    `/api/admin/dashboard?days=${days}${businessId ? `&businessId=${businessId}` : ""}`,
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
