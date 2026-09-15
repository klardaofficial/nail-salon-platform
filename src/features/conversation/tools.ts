import "server-only";

import { formatInTimeZone } from "date-fns-tz";
import type { FunctionTool, ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { z } from "zod";

import { queueWhatsAppMessage } from "@/features/messaging/outbox";
import { inngest } from "@/inngest/client";
import { getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ConversationActor = {
  conversationId: string;
  contactId: string;
  waId: string;
  ownerBusinessIds: string[];
  technicianIds: string[];
  currentMediaId: string | null;
};

const nullableUuid = { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] };
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

const customerTools: FunctionTool[] = [
  {
    type: "function",
    name: "save_booking_details",
    description: "Save any booking details learned so far without creating a booking.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        salonId: nullableUuid,
        startsAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
        timezone: nullableString,
        services: {
          type: "array",
          items: {
            type: "object",
            properties: { serviceId: nullableUuid, name: { type: "string" } },
            required: ["serviceId", "name"],
            additionalProperties: false,
          },
        },
        technicianRef: nullableUuid,
        additionalRequest: nullableString,
      },
      required: [
        "salonId",
        "startsAt",
        "timezone",
        "services",
        "technicianRef",
        "additionalRequest",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_booking",
    description:
      "Create and automatically confirm a booking after the customer has supplied a salon and future date/time and agreed to the details. Services and technician are optional.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        salonId: { type: "string", format: "uuid" },
        startsAt: { type: "string", format: "date-time" },
        services: {
          type: "array",
          items: {
            type: "object",
            properties: { serviceId: nullableUuid, name: { type: "string" } },
            required: ["serviceId", "name"],
            additionalProperties: false,
          },
        },
        technicianRef: nullableUuid,
        additionalRequest: nullableString,
      },
      required: ["salonId", "startsAt", "services", "technicianRef", "additionalRequest"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_my_bookings",
    description: "List this customer's upcoming and recent bookings.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "cancel_booking",
    description: "Cancel this customer's confirmed booking only if its start time has not arrived.",
    strict: true,
    parameters: {
      type: "object",
      properties: { bookingId: { type: "string", format: "uuid" }, reason: nullableString },
      required: ["bookingId", "reason"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "request_style_preview",
    description:
      "Generate up to three nail-style previews from the image sent in the current chat.",
    strict: true,
    parameters: {
      type: "object",
      properties: { styleRequest: { type: "string" } },
      required: ["styleRequest"],
      additionalProperties: false,
    },
  },
];

const ownerTools: FunctionTool[] = [
  {
    type: "function",
    name: "owner_booking_summary",
    description:
      "Show confirmed, cancelled, and customer counts for a business owned by this user.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        businessId: nullableUuid,
        days: { type: "integer", minimum: 1, maximum: 366 },
      },
      required: ["businessId", "days"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "owner_update_salon",
    description: "Update optional salon information for a business owned by this user.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        salonId: { type: "string", format: "uuid" },
        name: nullableString,
        locationLabel: nullableString,
        openTime: nullableString,
        closeTime: nullableString,
        customerCanChooseTechnician: { anyOf: [{ type: "boolean" }, { type: "null" }] },
      },
      required: [
        "salonId",
        "name",
        "locationLabel",
        "openTime",
        "closeTime",
        "customerCanChooseTechnician",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "owner_manage_service",
    description: "Create, update, or deactivate an optional service at an owned salon.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "deactivate"] },
        salonId: { type: "string", format: "uuid" },
        serviceId: nullableUuid,
        name: nullableString,
        description: nullableString,
      },
      required: ["action", "salonId", "serviceId", "name", "description"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "owner_manage_technician",
    description: "Create, update, or deactivate an optional technician at an owned salon.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "deactivate"] },
        salonId: { type: "string", format: "uuid" },
        technicianId: nullableUuid,
        displayName: nullableString,
        waId: nullableString,
      },
      required: ["action", "salonId", "technicianId", "displayName", "waId"],
      additionalProperties: false,
    },
  },
];

const technicianTools: FunctionTool[] = [
  {
    type: "function",
    name: "technician_list_bookings",
    description: "List upcoming bookings assigned to this technician only.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "technician_submit_time_off",
    description:
      "Record optional time off for this technician. It guides suggestions but does not cancel bookings.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        technicianId: { type: "string", format: "uuid" },
        startsAt: { type: "string", format: "date-time" },
        endsAt: { type: "string", format: "date-time" },
        note: nullableString,
      },
      required: ["technicianId", "startsAt", "endsAt", "note"],
      additionalProperties: false,
    },
  },
];

export function toolsForActor(actor: ConversationActor) {
  return [
    ...customerTools,
    ...(actor.ownerBusinessIds.length ? ownerTools : []),
    ...(actor.technicianIds.length ? technicianTools : []),
  ];
}

const serviceItemSchema = z.object({
  serviceId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(120),
});
const draftSchema = z.object({
  salonId: z.uuid().nullable(),
  startsAt: z.iso.datetime().nullable(),
  timezone: z.string().nullable(),
  services: z.array(serviceItemSchema).max(20),
  technicianRef: z.uuid().nullable(),
  additionalRequest: z.string().max(1000).nullable(),
});
const createSchema = draftSchema
  .omit({ timezone: true })
  .extend({ salonId: z.uuid(), startsAt: z.iso.datetime() });

async function ownedSalon(actor: ConversationActor, salonId: string) {
  const result = await createSupabaseAdminClient()
    .from("salons")
    .select("id,business_id,name")
    .eq("id", salonId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || !actor.ownerBusinessIds.includes(result.data.business_id))
    throw new Error("not_authorized");
  return result.data;
}

async function saveDraft(actor: ConversationActor, raw: unknown) {
  const values = draftSchema.parse(raw);
  const { error } = await createSupabaseAdminClient().from("booking_drafts").upsert(
    {
      conversation_id: actor.conversationId,
      salon_id: values.salonId,
      starts_at: values.startsAt,
      timezone: values.timezone,
      service_selections: values.services,
      technician_ref: values.technicianRef,
      additional_request: values.additionalRequest,
      state: "collecting",
    },
    { onConflict: "conversation_id" },
  );
  if (error) throw error;
  return { ok: true, saved: true };
}

async function createBooking(actor: ConversationActor, raw: unknown, callId: string) {
  const values = createSchema.parse(raw);
  const start = new Date(values.startsAt);
  if (start.getTime() <= Date.now()) throw new Error("booking_time_must_be_in_future");
  const supabase = createSupabaseAdminClient();
  const salonResult = await supabase
    .from("salons")
    .select("id,business_id,name,timezone,active")
    .eq("id", values.salonId)
    .is("deleted_at", null)
    .maybeSingle();
  if (salonResult.error) throw salonResult.error;
  const salon = salonResult.data;
  if (!salon?.active) throw new Error("salon_is_not_active");

  let technicianName: string | null = null;
  let technicianWaId: string | null = null;
  if (values.technicianRef) {
    const technician = await supabase
      .from("technicians")
      .select("display_name,wa_id,salon_id,active")
      .eq("id", values.technicianRef)
      .maybeSingle();
    if (technician.error) throw technician.error;
    const matchedTechnician = technician.data;
    if (matchedTechnician && matchedTechnician.salon_id === salon.id && matchedTechnician.active) {
      technicianName = matchedTechnician.display_name;
      technicianWaId = matchedTechnician.wa_id;
    }
  }

  const serviceIds = values.services.flatMap((service) =>
    service.serviceId ? [service.serviceId] : [],
  );
  const knownServices = serviceIds.length
    ? await supabase.from("services").select("id,name,salon_id").in("id", serviceIds)
    : { data: [], error: null };
  if (knownServices.error) throw knownServices.error;
  const known = new Map(
    (knownServices.data ?? [])
      .filter((item) => item.salon_id === salon.id)
      .map((item) => [item.id, item.name]),
  );
  const services = values.services.map((service) => ({
    serviceId: service.serviceId && known.has(service.serviceId) ? service.serviceId : null,
    name:
      service.serviceId && known.has(service.serviceId)
        ? known.get(service.serviceId)!
        : service.name,
  }));
  const localLabel = formatInTimeZone(start, salon.timezone, "yyyy-MM-dd HH:mm zzz");
  const { data: bookingId, error } = await supabase.rpc("create_booking_from_conversation", {
    p_business_id: salon.business_id,
    p_salon_id: salon.id,
    p_contact_id: actor.contactId,
    p_starts_at: start.toISOString(),
    p_timezone_snapshot: salon.timezone,
    p_local_time_label: localLabel,
    p_technician_ref: values.technicianRef,
    p_technician_name_snapshot: technicianName,
    p_additional_request: values.additionalRequest,
    p_idempotency_key: `${actor.conversationId}:${callId}`,
    p_services: services,
  });
  if (error) throw error;
  await supabase
    .from("booking_drafts")
    .update({ state: "completed" })
    .eq("conversation_id", actor.conversationId);

  if (technicianWaId) {
    const config = getServerEnv();
    const notification = config.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED
      ? {
          kind: "template" as const,
          name: config.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED,
          languageCode: config.BOT_LOCALE === "de" ? "de" : "en_US",
          bodyParameters: [salon.name, localLabel, String(bookingId)],
        }
      : {
          kind: "text" as const,
          text: `New booking at ${salon.name}: ${localLabel}. Booking ${bookingId}.`,
        };
    await queueWhatsAppMessage({
      recipientWaId: technicianWaId,
      payload: notification,
      deduplicationKey: `booking:${bookingId}:technician:confirmed`,
    });
  }
  return { ok: true, bookingId, status: "confirmed", salon: salon.name, startsAt: localLabel };
}

async function listCustomerBookings(actor: ConversationActor) {
  const { data, error } = await createSupabaseAdminClient()
    .from("bookings")
    .select(
      "id,starts_at,local_time_label,status,salon:salons(name),booking_services(service_name_snapshot)",
    )
    .eq("contact_id", actor.contactId)
    .order("starts_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return { ok: true, bookings: data };
}

async function cancelBooking(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({ bookingId: z.uuid(), reason: z.string().max(500).nullable() })
    .parse(raw);
  const supabase = createSupabaseAdminClient();
  const before = await supabase
    .from("bookings")
    .select("id,technician_ref,local_time_label,salon:salons(name)")
    .eq("id", values.bookingId)
    .eq("contact_id", actor.contactId)
    .maybeSingle();
  if (before.error) throw before.error;
  const { data: cancelled, error } = await supabase.rpc("cancel_customer_booking", {
    p_booking_id: values.bookingId,
    p_contact_id: actor.contactId,
    p_reason: values.reason,
  });
  if (error) throw error;
  if (!cancelled) return { ok: false, error: "booking_not_cancellable" };

  if (before.data?.technician_ref) {
    const technician = await supabase
      .from("technicians")
      .select("wa_id")
      .eq("id", before.data.technician_ref)
      .maybeSingle();
    if (technician.data?.wa_id) {
      const config = getServerEnv();
      const notification = config.WHATSAPP_TEMPLATE_BOOKING_CANCELLED
        ? {
            kind: "template" as const,
            name: config.WHATSAPP_TEMPLATE_BOOKING_CANCELLED,
            languageCode: config.BOT_LOCALE === "de" ? "de" : "en_US",
            bodyParameters: [values.bookingId],
          }
        : { kind: "text" as const, text: `Booking ${values.bookingId} was cancelled.` };
      await queueWhatsAppMessage({
        recipientWaId: technician.data.wa_id,
        payload: notification,
        deduplicationKey: `booking:${values.bookingId}:technician:cancelled`,
      });
    }
  }
  return { ok: true, bookingId: values.bookingId, status: "cancelled" };
}

async function requestPreview(actor: ConversationActor, raw: unknown, callId: string) {
  const { styleRequest } = z
    .object({ styleRequest: z.string().trim().min(1).max(1000) })
    .parse(raw);
  if (!actor.currentMediaId) throw new Error("send_a_hand_or_nail_photo_first");
  const env = getServerEnv();
  const supabase = createSupabaseAdminClient();
  const settings = await supabase
    .from("platform_settings")
    .select("preview_requests_per_day,previews_per_request,platform_timezone")
    .eq("singleton", true)
    .single();
  if (settings.error) throw settings.error;
  const usageDate = formatInTimeZone(new Date(), settings.data.platform_timezone, "yyyy-MM-dd");
  const { data: previewId, error } = await supabase.rpc("reserve_preview_request", {
    p_contact_id: actor.contactId,
    p_conversation_id: actor.conversationId,
    p_request_key: `${actor.conversationId}:${callId}`,
    p_usage_date: usageDate,
    p_source_media_id: actor.currentMediaId,
    p_style_request: styleRequest,
    p_requested_count: Math.min(settings.data.previews_per_request, env.PREVIEWS_PER_REQUEST),
    p_daily_limit: Math.min(settings.data.preview_requests_per_day, env.PREVIEW_REQUESTS_PER_DAY),
  });
  if (error) {
    if (error.message.includes("preview_quota_exceeded"))
      return { ok: false, error: "preview_quota_exceeded" };
    throw error;
  }
  await inngest.send({ name: "preview/requested", data: { previewId } });
  return { ok: true, previewId, status: "queued" };
}

function resolveOwnedBusiness(actor: ConversationActor, requested: string | null) {
  if (requested && actor.ownerBusinessIds.includes(requested)) return requested;
  if (!requested && actor.ownerBusinessIds.length === 1) return actor.ownerBusinessIds[0];
  throw new Error("choose_an_owned_business");
}

async function ownerSummary(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({ businessId: z.uuid().nullable(), days: z.number().int().min(1).max(366) })
    .parse(raw);
  const businessId = resolveOwnedBusiness(actor, values.businessId);
  const from = new Date(Date.now() - (values.days - 1) * 86_400_000).toISOString();
  const { data, error } = await createSupabaseAdminClient()
    .from("bookings")
    .select("status,contact_id")
    .eq("business_id", businessId)
    .gte("created_at", from);
  if (error) throw error;
  return {
    ok: true,
    days: values.days,
    total: data.length,
    confirmed: data.filter((item) => item.status === "confirmed").length,
    cancelled: data.filter((item) => item.status === "cancelled").length,
    customers: new Set(data.map((item) => item.contact_id)).size,
  };
}

async function ownerUpdateSalon(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      salonId: z.uuid(),
      name: z.string().trim().min(1).max(120).nullable(),
      locationLabel: z.string().trim().min(1).max(300).nullable(),
      openTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable(),
      closeTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable(),
      customerCanChooseTechnician: z.boolean().nullable(),
    })
    .parse(raw);
  await ownedSalon(actor, values.salonId);
  const updates = {
    ...(values.name ? { name: values.name } : {}),
    ...(values.locationLabel ? { location_label: values.locationLabel } : {}),
    ...(values.openTime ? { default_open_time: values.openTime } : {}),
    ...(values.closeTime ? { default_close_time: values.closeTime } : {}),
    ...(values.customerCanChooseTechnician === null
      ? {}
      : { customer_can_choose_technician: values.customerCanChooseTechnician }),
  };
  const { error } = await createSupabaseAdminClient()
    .from("salons")
    .update(updates)
    .eq("id", values.salonId);
  if (error) throw error;
  return { ok: true, updated: Object.keys(updates) };
}

async function ownerManageService(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      action: z.enum(["create", "update", "deactivate"]),
      salonId: z.uuid(),
      serviceId: z.uuid().nullable(),
      name: z.string().trim().min(1).max(120).nullable(),
      description: z.string().max(500).nullable(),
    })
    .parse(raw);
  await ownedSalon(actor, values.salonId);
  const supabase = createSupabaseAdminClient();
  if (values.action === "create") {
    if (!values.name) throw new Error("service_name_required");
    const result = await supabase
      .from("services")
      .insert({ salon_id: values.salonId, name: values.name, description: values.description })
      .select("id")
      .single();
    if (result.error) throw result.error;
    return { ok: true, serviceId: result.data.id };
  }
  if (!values.serviceId) throw new Error("service_id_required");
  const existing = await supabase
    .from("services")
    .select("salon_id")
    .eq("id", values.serviceId)
    .maybeSingle();
  if (existing.error || existing.data?.salon_id !== values.salonId)
    throw new Error("service_not_found");
  const updates =
    values.action === "deactivate"
      ? { active: false, deleted_at: new Date().toISOString() }
      : { ...(values.name ? { name: values.name } : {}), description: values.description };
  const { error } = await supabase.from("services").update(updates).eq("id", values.serviceId);
  if (error) throw error;
  return { ok: true, serviceId: values.serviceId };
}

async function ownerManageTechnician(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      action: z.enum(["create", "update", "deactivate"]),
      salonId: z.uuid(),
      technicianId: z.uuid().nullable(),
      displayName: z.string().trim().min(1).max(120).nullable(),
      waId: z.string().trim().min(5).max(32).nullable(),
    })
    .parse(raw);
  await ownedSalon(actor, values.salonId);
  const supabase = createSupabaseAdminClient();
  if (values.action === "create") {
    if (!values.displayName || !values.waId)
      throw new Error("technician_name_and_whatsapp_required");
    const result = await supabase
      .from("technicians")
      .insert({
        salon_id: values.salonId,
        display_name: values.displayName,
        wa_id: values.waId.replace(/^\+/, ""),
      })
      .select("id")
      .single();
    if (result.error) throw result.error;
    return { ok: true, technicianId: result.data.id };
  }
  if (!values.technicianId) throw new Error("technician_id_required");
  const existing = await supabase
    .from("technicians")
    .select("salon_id")
    .eq("id", values.technicianId)
    .maybeSingle();
  if (existing.error || existing.data?.salon_id !== values.salonId)
    throw new Error("technician_not_found");
  const updates =
    values.action === "deactivate"
      ? { active: false, deleted_at: new Date().toISOString() }
      : {
          ...(values.displayName ? { display_name: values.displayName } : {}),
          ...(values.waId ? { wa_id: values.waId.replace(/^\+/, "") } : {}),
        };
  const { error } = await supabase
    .from("technicians")
    .update(updates)
    .eq("id", values.technicianId);
  if (error) throw error;
  return { ok: true, technicianId: values.technicianId };
}

async function technicianBookings(actor: ConversationActor) {
  const { data, error } = await createSupabaseAdminClient()
    .from("bookings")
    .select("id,local_time_label,status,salon:salons(name),customer:contacts(display_name,wa_id)")
    .in("technician_ref", actor.technicianIds)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(20);
  if (error) throw error;
  return { ok: true, bookings: data };
}

async function technicianTimeOff(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      technicianId: z.uuid(),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      note: z.string().max(500).nullable(),
    })
    .parse(raw);
  if (!actor.technicianIds.includes(values.technicianId)) throw new Error("not_authorized");
  if (new Date(values.endsAt) <= new Date(values.startsAt))
    throw new Error("time_off_end_must_be_later");
  const result = await createSupabaseAdminClient()
    .from("technician_time_off")
    .insert({
      technician_id: values.technicianId,
      starts_at: values.startsAt,
      ends_at: values.endsAt,
      note: values.note,
    })
    .select("id")
    .single();
  if (result.error) throw result.error;
  return { ok: true, timeOffId: result.data.id };
}

async function runTool(actor: ConversationActor, call: ResponseFunctionToolCall, args: unknown) {
  switch (call.name) {
    case "save_booking_details":
      return saveDraft(actor, args);
    case "create_booking":
      return createBooking(actor, args, call.call_id);
    case "list_my_bookings":
      return listCustomerBookings(actor);
    case "cancel_booking":
      return cancelBooking(actor, args);
    case "request_style_preview":
      return requestPreview(actor, args, call.call_id);
    case "owner_booking_summary":
      return ownerSummary(actor, args);
    case "owner_update_salon":
      return ownerUpdateSalon(actor, args);
    case "owner_manage_service":
      return ownerManageService(actor, args);
    case "owner_manage_technician":
      return ownerManageTechnician(actor, args);
    case "technician_list_bookings":
      return technicianBookings(actor);
    case "technician_submit_time_off":
      return technicianTimeOff(actor, args);
    default:
      throw new Error("unknown_tool");
  }
}

export async function executeConversationTool(
  actor: ConversationActor,
  call: ResponseFunctionToolCall,
) {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("tool_executions")
    .select("state,result")
    .eq("conversation_id", actor.conversationId)
    .eq("tool_call_id", call.call_id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.state === "completed") return existing.data.result;

  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    args = {};
  }
  await supabase.from("tool_executions").upsert(
    {
      conversation_id: actor.conversationId,
      tool_call_id: call.call_id,
      tool_name: call.name,
      arguments: args,
      state: "started",
    },
    { onConflict: "conversation_id,tool_call_id" },
  );

  let result: unknown;
  try {
    result = await runTool(actor, call, args);
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "tool_failed" };
  }
  const { error: updateError } = await supabase
    .from("tool_executions")
    .update({ state: "completed", result, completed_at: new Date().toISOString() })
    .eq("conversation_id", actor.conversationId)
    .eq("tool_call_id", call.call_id);
  if (updateError) throw updateError;
  return result;
}
