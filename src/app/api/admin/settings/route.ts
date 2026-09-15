import { z } from "zod";

import { apiException, apiSuccess } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/api-admin";
import { getBotLocale, getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  platformTimezone: z.string().trim().min(1).max(80),
  defaultOpenTime: z.string().regex(/^\d{2}:\d{2}$/),
  defaultCloseTime: z.string().regex(/^\d{2}:\d{2}$/),
  defaultBookingIntervalMinutes: z.coerce.number().int().min(5).max(240),
  previewRequestsPerDay: z.coerce.number().int().min(1).max(100),
  previewsPerRequest: z.coerce.number().int().min(1).max(3),
  greetingEn: z.string().trim().min(1).max(1000),
  greetingDe: z.string().trim().min(1).max(1000),
  technicianBookingConfirmedTemplate: z
    .string()
    .trim()
    .max(512)
    .transform((value) => value || null),
  technicianBookingCancelledTemplate: z
    .string()
    .trim()
    .max(512)
    .transform((value) => value || null),
});

function mapSettings(row: Record<string, unknown> | null) {
  const defaults = getServerEnv();
  return {
    platformTimezone: String(row?.platform_timezone ?? defaults.PLATFORM_TIMEZONE),
    defaultOpenTime: String(row?.default_open_time ?? defaults.DEFAULT_OPEN_TIME).slice(0, 5),
    defaultCloseTime: String(row?.default_close_time ?? defaults.DEFAULT_CLOSE_TIME).slice(0, 5),
    defaultBookingIntervalMinutes: Number(
      row?.default_booking_interval_minutes ?? defaults.DEFAULT_BOOKING_INTERVAL_MINUTES,
    ),
    previewRequestsPerDay: Number(
      row?.preview_requests_per_day ?? defaults.PREVIEW_REQUESTS_PER_DAY,
    ),
    previewsPerRequest: Number(row?.previews_per_request ?? defaults.PREVIEWS_PER_REQUEST),
    greetingEn: String(row?.greeting_en ?? "Hello! How can I help you today?"),
    greetingDe: String(row?.greeting_de ?? "Hallo! Wie kann ich dir heute helfen?"),
    technicianBookingConfirmedTemplate:
      (row?.technician_booking_confirmed_template as string | null) ?? null,
    technicianBookingCancelledTemplate:
      (row?.technician_booking_cancelled_template as string | null) ?? null,
    botLocale: getBotLocale(),
  };
}

export async function GET() {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const { data, error } = await createSupabaseAdminClient()
      .from("platform_settings")
      .select("*")
      .eq("singleton", true)
      .single();
    if (error) throw error;
    return apiSuccess(mapSettings(data));
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireApiAdmin();
    if (guard.error) return guard.error;
    const values = settingsSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .update({
        platform_timezone: values.platformTimezone,
        default_open_time: values.defaultOpenTime,
        default_close_time: values.defaultCloseTime,
        default_booking_interval_minutes: values.defaultBookingIntervalMinutes,
        preview_requests_per_day: values.previewRequestsPerDay,
        previews_per_request: values.previewsPerRequest,
        greeting_en: values.greetingEn,
        greeting_de: values.greetingDe,
        technician_booking_confirmed_template: values.technicianBookingConfirmedTemplate,
        technician_booking_cancelled_template: values.technicianBookingCancelledTemplate,
      })
      .eq("singleton", true)
      .select("*")
      .single();
    if (error) throw error;

    const { error: auditError } = await supabase.from("audit_log").insert({
      actor_type: "platform_admin",
      actor_id: guard.admin.id,
      action: "platform_settings.updated",
      entity_type: "platform_settings",
      entity_id: "singleton",
    });
    if (auditError) throw auditError;
    return apiSuccess(mapSettings(data));
  } catch (error) {
    return apiException(error);
  }
}
