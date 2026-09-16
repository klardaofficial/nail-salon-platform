import { addDays, differenceInCalendarDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import type { TrendPoint } from "./types";

export type AnalyticsBooking = {
  contactId: string;
  createdAt: string;
  status: "confirmed" | "cancelled";
};

export function calculateAnalytics(
  bookings: AnalyticsBooking[],
  priorCustomerIds: Set<string>,
  from: string,
  to: string,
  timezone: string,
) {
  const points = new Map<string, TrendPoint>();
  const start = new Date(`${from}T12:00:00Z`);
  const days = differenceInCalendarDays(new Date(`${to}T12:00:00Z`), start) + 1;

  for (let offset = 0; offset < days; offset += 1) {
    const key = addDays(start, offset).toISOString().slice(0, 10);
    points.set(key, { date: key, confirmed: 0, cancelled: 0, total: 0 });
  }

  const uniqueCustomers = new Set<string>();
  for (const booking of bookings) {
    uniqueCustomers.add(booking.contactId);
    const key = formatInTimeZone(new Date(booking.createdAt), timezone, "yyyy-MM-dd");
    const point = points.get(key);
    if (!point) continue;
    point.total += 1;
    point[booking.status] += 1;
  }

  const returningCustomers = [...uniqueCustomers].filter((id) => priorCustomerIds.has(id)).length;
  const confirmed = bookings.filter((booking) => booking.status === "confirmed").length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;

  return {
    totals: {
      total: bookings.length,
      confirmed,
      cancelled,
      uniqueCustomers: uniqueCustomers.size,
      returningCustomers,
      repeatRate: uniqueCustomers.size
        ? Number(((returningCustomers / uniqueCustomers.size) * 100).toFixed(1))
        : 0,
    },
    trends: [...points.values()],
  };
}
