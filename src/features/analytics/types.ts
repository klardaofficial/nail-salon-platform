export type TrendPoint = {
  date: string;
  confirmed: number;
  cancelled: number;
  checkedIn: number;
  total: number;
};

export type DashboardData = {
  period: { from: string; to: string; timezone: string };
  totals: {
    total: number;
    confirmed: number;
    cancelled: number;
    checkedIn: number;
    uniqueCustomers: number;
    returningCustomers: number;
    repeatRate: number;
  };
  trends: TrendPoint[];
  recentBookings: {
    id: string;
    customerName: string;
    customerWhatsapp: string;
    startsAt: string;
    status: "confirmed" | "cancelled" | "checked_in";
  }[];
  health: {
    failedJobs: number;
    pendingMessages: number;
    previewFailures: number;
  };
};
