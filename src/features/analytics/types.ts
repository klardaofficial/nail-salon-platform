export type TrendPoint = {
  date: string;
  confirmed: number;
  cancelled: number;
  total: number;
};

export type DashboardData = {
  period: { days: number; from: string; to: string; timezone: string };
  totals: {
    total: number;
    confirmed: number;
    cancelled: number;
    uniqueCustomers: number;
    returningCustomers: number;
    repeatRate: number;
  };
  trends: TrendPoint[];
  businesses: { id: string; name: string }[];
  recentBookings: {
    id: string;
    customerName: string;
    salonName: string;
    startsAt: string;
    status: "confirmed" | "cancelled";
  }[];
  health: {
    failedJobs: number;
    pendingMessages: number;
    previewFailures: number;
  };
};
