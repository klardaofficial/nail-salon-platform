import { z } from "zod";

import { calculateAnalytics } from "@/features/analytics/calculate";
import {
  reportingBounds,
  reportingFields,
  reportingRangeMessage,
  validReportingRange,
} from "@/features/analytics/period";
import { apiException, apiSuccess } from "@/lib/api/response";
import { requireOrganizationAdmin } from "@/lib/auth/api-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z
  .object({ ...reportingFields, source: z.enum(["real", "simulator", "both"]).default("real") })
  .refine(validReportingRange, { message: reportingRangeMessage });

function relatedName(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "name" in value)
    return String((value as { name: unknown }).name);
  if (Array.isArray(value) && value[0] && typeof value[0] === "object" && "name" in value[0])
    return String((value[0] as { name: unknown }).name);
  return fallback;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const guard = await requireOrganizationAdmin(organizationId, { allowArchivedRead: true });
    if (guard.error) return guard.error;
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const supabase = createSupabaseAdminClient();
    const settings = await supabase
      .from("organization_settings")
      .select("platform_timezone,simulator_enabled")
      .eq("organization_id", organizationId)
      .single();
    if (settings.error) throw settings.error;
    const timezone = settings.data.platform_timezone;
    const source = settings.data.simulator_enabled ? input.source : "real";
    const { start, end } = reportingBounds(input.from, input.to, timezone);

    let cohortQuery = supabase
      .from("bookings")
      .select(
        "id,contact_id,created_at,starts_at,status,simulated,salon:salons!bookings_organization_salon_fkey(name),customer:contacts!bookings_organization_contact_fkey(display_name,wa_id)",
      )
      .eq("organization_id", organizationId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (source !== "both") cohortQuery = cohortQuery.eq("simulated", source === "simulator");
    const [cohortResult, failedJobs, pendingMessages, previewFailures] = await Promise.all([
      cohortQuery,
      supabase
        .from("job_outbox")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("state", "failed"),
      supabase
        .from("message_outbox")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("state", ["pending", "sending"]),
      supabase
        .from("preview_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("state", "failed"),
    ]);
    if (cohortResult.error) throw cohortResult.error;
    if (failedJobs.error) throw failedJobs.error;
    if (pendingMessages.error) throw pendingMessages.error;
    if (previewFailures.error) throw previewFailures.error;

    const contactIds = [...new Set((cohortResult.data ?? []).map((item) => item.contact_id))];
    const priorCustomerIds = new Set<string>();
    if (contactIds.length) {
      let priorQuery = supabase
        .from("bookings")
        .select("contact_id")
        .eq("organization_id", organizationId)
        .lt("created_at", start)
        .in("contact_id", contactIds);
      if (source !== "both") priorQuery = priorQuery.eq("simulated", source === "simulator");
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
      input.from,
      input.to,
      timezone,
    );
    return apiSuccess({
      period: { from: input.from, to: input.to, timezone },
      ...analytics,
      recentBookings: (cohortResult.data ?? []).slice(0, 8).map((booking) => ({
        id: booking.id,
        customerName: relatedName(booking.customer, "WhatsApp customer"),
        salonName: relatedName(booking.salon, "[N/A]"),
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
