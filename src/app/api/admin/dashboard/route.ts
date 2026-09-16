import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { z } from "zod";

import { calculateAnalytics } from "@/features/analytics/calculate";
import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import { getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine(({ from, to }) => from <= to, {
    message: "The start date must not be after the end date.",
  });

function relatedName(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name: unknown }).name);
  }
  if (Array.isArray(value) && value[0] && typeof value[0] === "object" && "name" in value[0]) {
    return String((value[0] as { name: unknown }).name);
  }
  return fallback;
}

export async function GET(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;

    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const supabase = createSupabaseAdminClient();
    const timezone = getServerEnv().PLATFORM_TIMEZONE;
    const from = fromZonedTime(`${query.from}T00:00:00.000`, timezone);
    const to = fromZonedTime(`${query.to}T23:59:59.999`, timezone);

    const cohortQuery = supabase
      .from("bookings")
      .select(
        "id, business_id, contact_id, created_at, starts_at, status, salon:salons(name), customer:contacts(display_name,wa_id)",
      )
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });
    const [cohortResult, failedJobs, pendingMessages, previewFailures] = await Promise.all([
      cohortQuery,
      supabase
        .from("job_outbox")
        .select("id", { count: "exact", head: true })
        .eq("state", "failed"),
      supabase
        .from("message_outbox")
        .select("id", { count: "exact", head: true })
        .in("state", ["pending", "sending"]),
      supabase
        .from("preview_requests")
        .select("id", { count: "exact", head: true })
        .eq("state", "failed"),
    ]);

    if (cohortResult.error) throw cohortResult.error;

    const contactIds = [...new Set((cohortResult.data ?? []).map((item) => item.contact_id))];
    const priorCustomerIds = new Set<string>();
    if (contactIds.length) {
      const priorQuery = supabase
        .from("bookings")
        .select("contact_id")
        .lt("created_at", from.toISOString())
        .in("contact_id", contactIds);
      const prior = await priorQuery;
      if (prior.error) throw prior.error;
      prior.data.forEach((booking) => priorCustomerIds.add(booking.contact_id));
    }

    const analytics = calculateAnalytics(
      (cohortResult.data ?? []).map((booking) => ({
        contactId: booking.contact_id,
        createdAt: booking.created_at,
        status: booking.status,
      })),
      priorCustomerIds,
      query.from,
      query.to,
      timezone,
    );

    return apiSuccess({
      period: {
        from: formatInTimeZone(from, timezone, "yyyy-MM-dd"),
        to: formatInTimeZone(to, timezone, "yyyy-MM-dd"),
        timezone,
      },
      ...analytics,
      recentBookings: (cohortResult.data ?? []).slice(0, 8).map((booking) => ({
        id: booking.id,
        customerName:
          relatedName(booking.customer, "") ||
          (booking.customer && typeof booking.customer === "object" && "wa_id" in booking.customer
            ? String((booking.customer as { wa_id: unknown }).wa_id)
            : "WhatsApp customer"),
        salonName: relatedName(booking.salon, "Unknown salon"),
        startsAt: booking.starts_at,
        status: booking.status,
      })),
      health: {
        failedJobs: failedJobs.count ?? 0,
        pendingMessages: pendingMessages.count ?? 0,
        previewFailures: previewFailures.count ?? 0,
      },
    });
  } catch (error) {
    return apiException(error);
  }
}
