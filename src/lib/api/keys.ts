export const apiKeys = {
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
