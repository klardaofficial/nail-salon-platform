export type TrendPoint = {
  date: string;
  confirmed: number;
  cancelled: number;
  total: number;
};

export type DashboardData = {
  period: { from: string; to: string; timezone: string };
  totals: {
    total: number;
    confirmed: number;
    cancelled: number;
    uniqueCustomers: number;
    returningCustomers: number;
    repeatRate: number;
  };
  trends: TrendPoint[];
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
