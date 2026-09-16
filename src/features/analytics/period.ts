import { addDays, differenceInCalendarDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

export const reportingFields = { from: z.iso.date(), to: z.iso.date() };
export function validReportingRange({ from, to }: { from: string; to: string }) {
  return from <= to && differenceInCalendarDays(new Date(to), new Date(from)) < 366;
}
export const reportingRangeMessage = "Choose an ordered date range of at most 366 days.";
export const reportingQuerySchema = z
  .object(reportingFields)
  .refine(validReportingRange, { message: reportingRangeMessage });

export function reportingBounds(from: string, to: string, timezone: string) {
  const nextDay = addDays(new Date(`${to}T12:00:00Z`), 1)
    .toISOString()
    .slice(0, 10);
  return {
    start: fromZonedTime(`${from}T00:00:00`, timezone).toISOString(),
    end: fromZonedTime(`${nextDay}T00:00:00`, timezone).toISOString(),
  };
}
