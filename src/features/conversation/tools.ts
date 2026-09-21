import "server-only";

import { formatInTimeZone } from "date-fns-tz";
import type { FunctionTool, ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { z } from "zod";
import { queueTechnicianBookingNotification } from "./notifications";
import { formatConversationTime, getConversationTimezone, withConversationTimes } from "./datetime";

import { inngest } from "@/inngest/client";
import type { BotLocale } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ConversationActor = {
  organizationId: string;
  businessId: string;
  locale?: BotLocale;
  transport?: "whatsapp" | "simulator";
  conversationId: string;
  contactId: string;
  waId: string;
  isOwner: boolean;
  technicianIds: string[];
  currentMediaId: string | null;
};

const nullableUuid = { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] };
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableUuidArray = {
  anyOf: [{ type: "array", items: { type: "string", format: "uuid" } }, { type: "null" }],
};

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
    name: "create_booking",
    description:
      "Create and automatically confirm an agreed future booking. A clear request to book the supplied details counts as agreement. salonId may be null when no active salons exist; a sole active salon is selected automatically. Services and technician are optional.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        salonId: nullableUuid,
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
    name: "update_booking",
    description:
      "Update the appointment time, salon, services, technician, or additional request of this customer's own confirmed future booking in place. It preserves the booking reference; it never cancels and recreates the booking.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        bookingId: { type: "string", format: "uuid" },
        salonId: nullableUuid,
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
      required: [
        "bookingId",
        "salonId",
        "startsAt",
        "services",
        "technicianRef",
        "additionalRequest",
      ],
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

const summaryParameters = {
  type: "object",
  properties: {
    from: nullableString,
    to: nullableString,
    dateBasis: { type: "string", enum: ["appointment", "created"] },
  },
  required: ["from", "to", "dateBasis"],
  additionalProperties: false,
};

const ownerTools: FunctionTool[] = [
  {
    type: "function",
    name: "owner_list_bookings",
    description:
      "List this business's bookings with customer details, services, requests, salon and technician. Optional date/status filters; returns 20 bookings per page with nextOffset. Null date filters include past and future records.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        from: nullableString,
        to: nullableString,
        status: { type: ["string", "null"], enum: ["confirmed", "cancelled", "checked_in", null] },
        offset: { type: "integer", minimum: 0 },
      },
      required: ["from", "to", "status", "offset"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "owner_booking_summary",
    description:
      "Query complete business booking totals, confirmed/cancelled/checked-in counts and distinct customers from the database. Use appointment dates for scheduled visits, created dates for bookings received. from is inclusive, to exclusive; null is unbounded.",
    strict: true,
    parameters: summaryParameters,
  },
  {
    type: "function",
    name: "owner_update_salon",
    description: "Update optional salon information for this business.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        salonId: { type: "string", format: "uuid" },
        name: nullableString,
        locationLabel: nullableString,
        openTime: nullableString,
        closeTime: nullableString,
      },
      required: ["salonId", "name", "locationLabel", "openTime", "closeTime"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "owner_manage_service",
    description:
      "Create, update, or deactivate an optional reference service. salonIds=null means it is available at every salon; one or more IDs restrict it to those salons.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "update", "deactivate"] },
        salonIds: nullableUuidArray,
        serviceId: nullableUuid,
        name: nullableString,
        description: nullableString,
      },
      required: ["action", "salonIds", "serviceId", "name", "description"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "owner_manage_technician",
    description: "Create, update, or deactivate an optional technician at this business's salon.",
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
    name: "technician_booking_summary",
    description:
      "Query complete totals, confirmed/cancelled/checked-in counts and distinct customers for this technician's assigned bookings only. Use appointment dates for scheduled visits, created dates for bookings received. from is inclusive, to exclusive; null is unbounded.",
    strict: true,
    parameters: summaryParameters,
  },
  {
    type: "function",
    name: "technician_list_bookings",
    description:
      "List upcoming assigned bookings with customer/service/request details, 20 per page. Use nextOffset to continue; total is the full matching count.",
    strict: true,
    parameters: {
      type: "object",
      properties: { offset: { type: "integer", minimum: 0 } },
      required: ["offset"],
      additionalProperties: false,
    },
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
    ...(actor.isOwner ? ownerTools : []),
    ...(actor.technicianIds.length ? technicianTools : []),
  ];
}

export const serviceItemSchema = z.object({
  serviceId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(120),
});
const draftSchema = z.object({
  salonId: z.uuid().nullable(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  services: z.array(serviceItemSchema).max(20),
  technicianRef: z.uuid().nullable(),
  additionalRequest: z.string().max(1000).nullable(),
});
const createSchema = draftSchema.extend({ startsAt: z.iso.datetime({ offset: true }) });

export async function normalizeServiceSelections(
  organizationId: string,
  services: z.infer<typeof serviceItemSchema>[],
  salonId: string | null,
) {
  const serviceIds = services.flatMap((service) => (service.serviceId ? [service.serviceId] : []));
  if (!serviceIds.length)
    return services.map((service) => ({ serviceId: null, name: service.name }));
  const supabase = createSupabaseAdminClient();
  const knownServices = await supabase
    .from("services")
    .select("id,name,service_salons!service_salons_organization_service_fkey(salon_id)")
    .in("id", serviceIds)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .is("deleted_at", null);
  if (knownServices.error) throw knownServices.error;
  const known = new Map(
    (knownServices.data ?? [])
      .filter((service) => {
        const scopes = service.service_salons ?? [];
        return scopes.length === 0 || scopes.some((scope) => scope.salon_id === salonId);
      })
      .map((service) => [service.id, service.name]),
  );
  return services.map((service) => ({
    serviceId: service.serviceId && known.has(service.serviceId) ? service.serviceId : null,
    name:
      service.serviceId && known.has(service.serviceId)
        ? known.get(service.serviceId)!
        : service.name,
  }));
}

async function ownedSalon(actor: ConversationActor, salonId: string) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from("salons")
    .select("id,business_id,name")
    .eq("id", salonId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (result.error) throw result.error;
  const owner = await supabase
    .from("business_owners")
    .select("business_id")
    .eq("contact_id", actor.contactId)
    .eq("organization_id", actor.organizationId)
    .eq("business_id", result.data?.business_id ?? "")
    .maybeSingle();
  if (owner.error) throw owner.error;
  if (!result.data || !owner.data) throw new Error("not_authorized");
  return result.data;
}

async function ownedSalons(actor: ConversationActor, salonIds: string[] | null) {
  const supabase = createSupabaseAdminClient();
  const { data: owner, error: ownerError } = await supabase
    .from("business_owners")
    .select("business_id")
    .eq("contact_id", actor.contactId)
    .eq("organization_id", actor.organizationId);
  if (ownerError) throw ownerError;
  const ownerBusinessIds = new Set((owner ?? []).map((item) => item.business_id));
  if (!ownerBusinessIds.size) throw new Error("not_authorized");
  if (!salonIds?.length) return;
  const uniqueSalonIds = [...new Set(salonIds)];
  const { data: salons, error } = await supabase
    .from("salons")
    .select("id,business_id")
    .eq("organization_id", actor.organizationId)
    .in("id", uniqueSalonIds);
  if (error) throw error;
  if ((salons ?? []).length !== uniqueSalonIds.length) throw new Error("service_salon_not_found");
  if ((salons ?? []).some((salon) => !ownerBusinessIds.has(salon.business_id)))
    throw new Error("not_authorized");
}

async function replaceServiceSalons(
  organizationId: string,
  serviceId: string,
  salonIds: string[] | null,
) {
  const supabase = createSupabaseAdminClient();
  const { error: removeError } = await supabase
    .from("service_salons")
    .delete()
    .eq("organization_id", organizationId)
    .eq("service_id", serviceId);
  if (removeError) throw removeError;
  const uniqueSalonIds = [...new Set(salonIds ?? [])];
  if (!uniqueSalonIds.length) return;
  const { error } = await supabase.from("service_salons").insert(
    uniqueSalonIds.map((salon_id) => ({
      organization_id: organizationId,
      service_id: serviceId,
      salon_id,
    })),
  );
  if (error) throw error;
}

async function saveDraft(actor: ConversationActor, raw: unknown) {
  const values = draftSchema.parse(raw);
  const timezone = await getConversationTimezone(actor.organizationId);
  const { error } = await createSupabaseAdminClient().from("booking_drafts").upsert(
    {
      organization_id: actor.organizationId,
      conversation_id: actor.conversationId,
      salon_id: values.salonId,
      starts_at: values.startsAt,
      timezone,
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
  const [salons, business, platform] = await Promise.all([
    supabase
      .from("salons")
      .select("id,business_id,name")
      .eq("organization_id", actor.organizationId)
      .eq("active", true)
      .is("deleted_at", null),
    supabase
      .from("businesses")
      .select("id,active")
      .eq("organization_id", actor.organizationId)
      .eq("id", actor.businessId)
      .single(),
    supabase
      .from("organization_settings")
      .select("platform_timezone")
      .eq("organization_id", actor.organizationId)
      .single(),
  ]);
  if (salons.error) throw salons.error;
  if (business.error) throw business.error;
  if (platform.error) throw platform.error;
  if (!business.data.active) throw new Error("business_is_not_active");
  const salon = values.salonId ? salons.data.find((item) => item.id === values.salonId) : null;
  if (values.salonId && !salon) throw new Error("salon_is_not_active");
  const timezone = platform.data.platform_timezone;
  const salonName = salon?.name;

  let technicianName: string | null = null;
  let technicianWaId: string | null = null;
  let technicianRef = salon ? values.technicianRef : null;
  if (technicianRef) {
    const technician = await supabase
      .from("technicians")
      .select("display_name,wa_id,salon_id,active")
      .eq("id", technicianRef)
      .eq("organization_id", actor.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (technician.error) throw technician.error;
    const matchedTechnician = technician.data;
    if (matchedTechnician && matchedTechnician.salon_id !== salon?.id) technicianRef = null;
    if (matchedTechnician && matchedTechnician.salon_id === salon?.id && matchedTechnician.active) {
      technicianName = matchedTechnician.display_name;
      technicianWaId = matchedTechnician.wa_id;
    }
  }

  const services = await normalizeServiceSelections(
    actor.organizationId,
    values.services,
    salon?.id ?? null,
  );
  const localLabel = formatConversationTime(start, timezone);
  const { data: bookingId, error } = await supabase.rpc("create_organization_booking", {
    p_organization_id: actor.organizationId,
    p_business_id: business.data.id,
    p_salon_id: salon?.id ?? null,
    p_contact_id: actor.contactId,
    p_starts_at: start.toISOString(),
    p_timezone_snapshot: timezone,
    p_local_time_label: localLabel,
    p_technician_ref: technicianRef,
    p_technician_name_snapshot: technicianName,
    p_additional_request: values.additionalRequest,
    p_idempotency_key: `${actor.conversationId}:${callId}`,
    p_services: services,
    p_channel: actor.transport === "simulator" ? "whatsapp_simulator" : "whatsapp",
  });
  if (error) {
    if (error.message.includes("active_booking_exists")) {
      const active = await supabase
        .from("bookings")
        .select("id,local_time_label")
        .eq("organization_id", actor.organizationId)
        .eq("contact_id", actor.contactId)
        .eq("status", "confirmed")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (active.error) throw active.error;
      if (active.data) {
        // Seed the draft the customer was just describing so a later
        // booking:update:<id> tap has something to apply -- without this the
        // model may present the two-option reply without ever calling
        // save_booking_details itself, leaving rescheduleBookingFromDraft
        // with nothing to work from.
        const { error: draftError } = await supabase.from("booking_drafts").upsert(
          {
            organization_id: actor.organizationId,
            conversation_id: actor.conversationId,
            salon_id: salon?.id ?? null,
            starts_at: start.toISOString(),
            timezone,
            service_selections: services,
            technician_ref: technicianRef,
            additional_request: values.additionalRequest,
            state: "collecting",
          },
          { onConflict: "conversation_id" },
        );
        if (draftError) throw draftError;
        return {
          ok: false,
          error: "active_booking_exists",
          activeBookingId: active.data.id,
          activeStartsAt: active.data.local_time_label,
        };
      }
    }
    throw error;
  }
  await supabase
    .from("booking_drafts")
    .update({ state: "completed" })
    .eq("conversation_id", actor.conversationId);

  if (technicianWaId) {
    const contact = await supabase
      .from("contacts")
      .select("display_name,wa_id")
      .eq("id", actor.contactId)
      .eq("organization_id", actor.organizationId)
      .single();
    if (contact.error) throw contact.error;
    await queueTechnicianBookingNotification({
      organizationId: actor.organizationId,
      transport: actor.transport,
      status: "confirmed",
      technicianWaId,
      bodyParameters: [
        salonName ?? "[N/A]",
        contact.data.display_name || "[N/A]",
        contact.data.wa_id,
        localLabel,
        String(bookingId),
      ],
      deduplicationKey: `booking:${bookingId}:technician:confirmed`,
    });
  }
  return {
    ok: true,
    bookingId,
    status: "confirmed",
    ...(salonName ? { salon: salonName } : {}),
    ...(technicianName ? { technician: technicianName } : {}),
    startsAt: localLabel,
  };
}

async function listCustomerBookings(actor: ConversationActor) {
  const { data, error } = await createSupabaseAdminClient()
    .from("bookings")
    .select(
      "id,salon_id,technician_ref,additional_request,starts_at,local_time_label,status,salon:salons!bookings_organization_salon_fkey(name),booking_services!booking_services_organization_booking_fkey(service_id,service_name_snapshot)",
    )
    .eq("contact_id", actor.contactId)
    .eq("organization_id", actor.organizationId)
    .order("starts_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return { ok: true, bookings: await withConversationTimes(actor.organizationId, data ?? []) };
}

async function cancelBooking(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({ bookingId: z.uuid(), reason: z.string().max(500).nullable() })
    .parse(raw);
  const supabase = createSupabaseAdminClient();
  const before = await supabase
    .from("bookings")
    .select("id,technician_ref,starts_at,salon:salons!bookings_organization_salon_fkey(name)")
    .eq("id", values.bookingId)
    .eq("contact_id", actor.contactId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (before.error) throw before.error;
  const { data: cancelled, error } = await supabase.rpc("cancel_organization_booking", {
    p_organization_id: actor.organizationId,
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
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (technician.data?.wa_id) {
      const [settings, contact] = await Promise.all([
        supabase
          .from("organization_settings")
          .select("platform_timezone")
          .eq("organization_id", actor.organizationId)
          .single(),
        supabase
          .from("contacts")
          .select("display_name,wa_id")
          .eq("id", actor.contactId)
          .eq("organization_id", actor.organizationId)
          .single(),
      ]);
      if (settings.error) throw settings.error;
      if (contact.error) throw contact.error;
      const salonRelation = before.data.salon as unknown as
        { name?: string } | { name?: string }[] | null;
      const salonName =
        (Array.isArray(salonRelation) ? salonRelation[0]?.name : salonRelation?.name) ?? "[N/A]";
      await queueTechnicianBookingNotification({
        organizationId: actor.organizationId,
        transport: actor.transport,
        status: "cancelled",
        technicianWaId: technician.data.wa_id,
        bodyParameters: [
          salonName,
          contact.data.display_name || "[N/A]",
          contact.data.wa_id,
          formatConversationTime(before.data.starts_at, settings.data.platform_timezone),
          values.bookingId,
        ],
        deduplicationKey: `booking:${values.bookingId}:technician:cancelled`,
      });
    }
  }
  return { ok: true, bookingId: values.bookingId, status: "cancelled" };
}

async function updateBooking(actor: ConversationActor, raw: unknown, callId: string) {
  const values = z
    .object({
      bookingId: z.uuid(),
      salonId: z.uuid().nullable(),
      startsAt: z.iso.datetime({ offset: true }),
      services: z.array(serviceItemSchema).max(20),
      technicianRef: z.uuid().nullable(),
      additionalRequest: z.string().max(1000).nullable(),
    })
    .parse(raw);
  const start = new Date(values.startsAt);
  if (start.getTime() <= Date.now()) throw new Error("booking_time_must_be_in_future");

  const supabase = createSupabaseAdminClient();
  const [before, settings, salons] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id,starts_at,business_id,technician_ref,salon:salons!bookings_organization_salon_fkey(name)",
      )
      .eq("id", values.bookingId)
      .eq("contact_id", actor.contactId)
      .eq("organization_id", actor.organizationId)
      .maybeSingle(),
    supabase
      .from("organization_settings")
      .select("platform_timezone")
      .eq("organization_id", actor.organizationId)
      .single(),
    supabase
      .from("salons")
      .select("id,business_id,name")
      .eq("organization_id", actor.organizationId)
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  if (before.error) throw before.error;
  if (settings.error) throw settings.error;
  if (salons.error) throw salons.error;
  if (!before.data) return { ok: false, error: "booking_not_reschedulable" };
  const existingBooking = before.data;
  const activeSalons = salons.data.filter(
    (salon) => salon.business_id === existingBooking.business_id,
  );
  const salon = values.salonId ? activeSalons.find((item) => item.id === values.salonId) : null;
  if (values.salonId && !salon) throw new Error("salon_is_not_active");

  let technicianRef = salon ? values.technicianRef : null;
  let technicianName: string | null = null;
  let technicianWaId: string | null = null;
  if (technicianRef) {
    const technician = await supabase
      .from("technicians")
      .select("display_name,wa_id,salon_id,active")
      .eq("id", technicianRef)
      .eq("organization_id", actor.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (technician.error) throw technician.error;
    if (technician.data && technician.data.salon_id !== salon?.id) technicianRef = null;
    if (technician.data && technician.data.salon_id === salon?.id && technician.data.active) {
      technicianName = technician.data.display_name;
      technicianWaId = technician.data.wa_id;
    }
  }
  const services = await normalizeServiceSelections(
    actor.organizationId,
    values.services,
    salon?.id ?? null,
  );
  const startsAt = formatConversationTime(start, settings.data.platform_timezone);
  const { data: rescheduled, error } = await supabase.rpc("reschedule_organization_booking", {
    p_organization_id: actor.organizationId,
    p_booking_id: values.bookingId,
    p_contact_id: actor.contactId,
    p_salon_id: salon?.id ?? null,
    p_starts_at: start.toISOString(),
    p_timezone_snapshot: settings.data.platform_timezone,
    p_local_time_label: startsAt,
    p_technician_ref: technicianRef,
    p_technician_name_snapshot: technicianName,
    p_additional_request: values.additionalRequest,
    p_services: services,
    p_idempotency_key: `${actor.conversationId}:${callId}`,
  });
  if (error) throw error;
  if (!rescheduled) return { ok: false, error: "booking_not_reschedulable" };

  const oldTechnicianWaId =
    existingBooking.technician_ref && existingBooking.technician_ref !== technicianRef
      ? (
          await supabase
            .from("technicians")
            .select("wa_id")
            .eq("id", existingBooking.technician_ref)
            .eq("organization_id", actor.organizationId)
            .maybeSingle()
        ).data?.wa_id
      : null;
  if (oldTechnicianWaId || technicianWaId) {
    const contact = await supabase
      .from("contacts")
      .select("display_name,wa_id")
      .eq("id", actor.contactId)
      .eq("organization_id", actor.organizationId)
      .single();
    if (contact.error) throw contact.error;
    const oldSalonRelation = existingBooking.salon as unknown as
      { name?: string } | { name?: string }[] | null;
    const oldSalonName =
      (Array.isArray(oldSalonRelation) ? oldSalonRelation[0]?.name : oldSalonRelation?.name) ??
      "[N/A]";
    const customer = contact.data.display_name || "[N/A]";
    if (oldTechnicianWaId) {
      await queueTechnicianBookingNotification({
        organizationId: actor.organizationId,
        transport: actor.transport,
        status: "cancelled",
        technicianWaId: oldTechnicianWaId,
        bodyParameters: [
          oldSalonName,
          customer,
          contact.data.wa_id,
          formatConversationTime(existingBooking.starts_at, settings.data.platform_timezone),
          values.bookingId,
        ],
        deduplicationKey: `booking:${values.bookingId}:technician:cancelled:update:${callId}`,
      });
    }
    if (technicianWaId) {
      await queueTechnicianBookingNotification({
        organizationId: actor.organizationId,
        transport: actor.transport,
        status: "confirmed",
        technicianWaId,
        bodyParameters: [
          salon?.name ?? "[N/A]",
          customer,
          contact.data.wa_id,
          startsAt,
          values.bookingId,
        ],
        deduplicationKey: `booking:${values.bookingId}:technician:confirmed:update:${callId}`,
      });
    }
  }
  return {
    ok: true,
    bookingId: values.bookingId,
    status: "rescheduled",
    previousStartsAt: formatConversationTime(
      existingBooking.starts_at,
      settings.data.platform_timezone,
    ),
    ...(salon ? { salon: salon.name } : {}),
    ...(technicianName ? { technician: technicianName } : {}),
    services,
    additionalRequest: values.additionalRequest,
    startsAt,
  };
}

async function requestPreview(actor: ConversationActor, raw: unknown, callId: string) {
  const { styleRequest } = z
    .object({ styleRequest: z.string().trim().min(1).max(1000) })
    .parse(raw);
  if (!actor.currentMediaId) throw new Error("send_a_hand_or_nail_photo_first");
  const supabase = createSupabaseAdminClient();
  const settings = await supabase
    .from("organization_settings")
    .select("preview_requests_per_day,previews_per_request,platform_timezone")
    .eq("organization_id", actor.organizationId)
    .single();
  if (settings.error) throw settings.error;
  const usageDate = formatInTimeZone(new Date(), settings.data.platform_timezone, "yyyy-MM-dd");
  const { data: previewId, error } = await supabase.rpc("reserve_organization_preview", {
    p_organization_id: actor.organizationId,
    p_contact_id: actor.contactId,
    p_conversation_id: actor.conversationId,
    p_request_key: `${actor.conversationId}:${callId}`,
    p_usage_date: usageDate,
    p_source_media_id: actor.currentMediaId,
    p_style_request: styleRequest,
    p_requested_count: settings.data.previews_per_request,
    p_daily_limit: settings.data.preview_requests_per_day,
  });
  if (error) {
    if (error.message.includes("preview_quota_exceeded"))
      return { ok: false, error: "preview_quota_exceeded" };
    throw error;
  }
  await inngest.send({
    name: "preview/requested",
    data: { organizationId: actor.organizationId, previewId },
  });
  return { ok: true, previewId, status: "queued" };
}

async function staffBookingSummary(
  actor: ConversationActor,
  raw: unknown,
  role: "owner" | "technician",
) {
  const values = z
    .object({
      from: z.iso.datetime({ offset: true }).nullable(),
      to: z.iso.datetime({ offset: true }).nullable(),
      dateBasis: z.enum(["appointment", "created"]),
    })
    .parse(raw);
  if (values.from && values.to && new Date(values.from) >= new Date(values.to))
    throw new Error("invalid_date_range");
  const supabase = createSupabaseAdminClient();
  if (role === "owner") {
    const owner = await supabase
      .from("business_owners")
      .select("business_id")
      .eq("contact_id", actor.contactId)
      .eq("organization_id", actor.organizationId)
      .maybeSingle();
    if (owner.error) throw owner.error;
    if (!owner.data) throw new Error("not_authorized");
  } else {
    await verifiedTechnicianIds(actor);
  }
  const { data, error } = await supabase.rpc("get_staff_booking_summary", {
    p_organization_id: actor.organizationId,
    p_contact_id: actor.contactId,
    p_role: role,
    p_from: values.from,
    p_to: values.to,
    p_date_basis: values.dateBasis,
  });
  if (error) throw error;
  return { ok: true, summary: data };
}

async function ownerListBookings(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      from: z.iso.datetime({ offset: true }).nullable(),
      to: z.iso.datetime({ offset: true }).nullable(),
      status: z.enum(["confirmed", "cancelled", "checked_in"]).nullable(),
      offset: z.number().int().min(0).max(1_000_000),
    })
    .parse(raw);
  if (values.from && values.to && new Date(values.from) > new Date(values.to))
    throw new Error("invalid_date_range");
  const supabase = createSupabaseAdminClient();
  const owner = await supabase
    .from("business_owners")
    .select("business_id")
    .eq("contact_id", actor.contactId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (owner.error) throw owner.error;
  if (!owner.data) throw new Error("not_authorized");
  let query = supabase
    .from("bookings")
    .select(
      "id,status,local_time_label,starts_at,technician_name_snapshot,additional_request,salon:salons!bookings_organization_salon_fkey(name),customer:contacts!bookings_organization_contact_fkey(display_name,wa_id),booking_services!booking_services_organization_booking_fkey(service_name_snapshot)",
      { count: "exact" },
    )
    .eq("organization_id", actor.organizationId)
    .eq("business_id", owner.data.business_id)
    .order("starts_at")
    .order("id");
  if (values.from) query = query.gte("starts_at", values.from);
  if (values.to) query = query.lte("starts_at", values.to);
  if (values.status) query = query.eq("status", values.status);
  const { data, count, error } = await query.range(values.offset, values.offset + 19);
  if (error) throw error;
  return {
    ok: true,
    bookings: await withConversationTimes(actor.organizationId, data ?? []),
    total: count,
    nextOffset: values.offset + 20 < (count ?? 0) ? values.offset + 20 : null,
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
    })
    .parse(raw);
  await ownedSalon(actor, values.salonId);
  const updates = {
    ...(values.name ? { name: values.name } : {}),
    ...(values.locationLabel ? { location_label: values.locationLabel } : {}),
    ...(values.openTime ? { default_open_time: values.openTime } : {}),
    ...(values.closeTime ? { default_close_time: values.closeTime } : {}),
  };
  const { error } = await createSupabaseAdminClient()
    .from("salons")
    .update(updates)
    .eq("id", values.salonId)
    .eq("organization_id", actor.organizationId);
  if (error) throw error;
  return { ok: true, updated: Object.keys(updates) };
}

async function ownerManageService(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      action: z.enum(["create", "update", "deactivate"]),
      salonIds: z.array(z.uuid()).max(100).nullable(),
      serviceId: z.uuid().nullable(),
      name: z.string().trim().min(1).max(120).nullable(),
      description: z.string().max(500).nullable(),
    })
    .parse(raw);
  await ownedSalons(actor, values.salonIds);
  const supabase = createSupabaseAdminClient();
  if (values.action === "create") {
    if (!values.name) throw new Error("service_name_required");
    const result = await supabase
      .from("services")
      .insert({
        organization_id: actor.organizationId,
        name: values.name,
        description: values.description,
      })
      .select("id")
      .single();
    if (result.error) throw result.error;
    await replaceServiceSalons(actor.organizationId, result.data.id, values.salonIds);
    return { ok: true, serviceId: result.data.id };
  }
  if (!values.serviceId) throw new Error("service_id_required");
  const existing = await supabase
    .from("services")
    .select("id")
    .eq("id", values.serviceId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (existing.error || !existing.data) throw new Error("service_not_found");
  const updates =
    values.action === "deactivate"
      ? { active: false, deleted_at: new Date().toISOString() }
      : { ...(values.name ? { name: values.name } : {}), description: values.description };
  const { error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", values.serviceId)
    .eq("organization_id", actor.organizationId);
  if (error) throw error;
  if (values.action === "update")
    await replaceServiceSalons(actor.organizationId, values.serviceId, values.salonIds);
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
        organization_id: actor.organizationId,
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
    .eq("organization_id", actor.organizationId)
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
    .eq("id", values.technicianId)
    .eq("organization_id", actor.organizationId);
  if (error) throw error;
  return { ok: true, technicianId: values.technicianId };
}

async function technicianBookings(actor: ConversationActor, raw: unknown) {
  const { offset } = z
    .object({ offset: z.number().int().min(0).max(1_000_000).default(0) })
    .parse(raw);
  const technicianIds = await verifiedTechnicianIds(actor);
  const { data, count, error } = await createSupabaseAdminClient()
    .from("bookings")
    .select(
      "id,starts_at,local_time_label,status,additional_request,salon:salons!bookings_organization_salon_fkey(name),customer:contacts!bookings_organization_contact_fkey(display_name,wa_id),booking_services!booking_services_organization_booking_fkey(service_name_snapshot)",
      { count: "exact" },
    )
    .eq("organization_id", actor.organizationId)
    .eq("simulated", false)
    .in("technician_ref", technicianIds)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .order("id")
    .range(offset, offset + 19);
  if (error) throw error;
  return {
    ok: true,
    bookings: await withConversationTimes(actor.organizationId, data ?? []),
    total: count,
    nextOffset: offset + 20 < (count ?? 0) ? offset + 20 : null,
  };
}

async function verifiedTechnicianIds(actor: ConversationActor) {
  const { data, error } = await createSupabaseAdminClient()
    .from("technicians")
    .select("id")
    .eq("wa_id", actor.waId)
    .eq("organization_id", actor.organizationId)
    .eq("active", true)
    .is("deleted_at", null);
  if (error) throw error;
  const ids = (data ?? []).map((technician) => technician.id);
  if (!ids.length) throw new Error("not_authorized");
  return ids;
}

async function technicianTimeOff(actor: ConversationActor, raw: unknown) {
  const values = z
    .object({
      technicianId: z.uuid(),
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
      note: z.string().max(500).nullable(),
    })
    .parse(raw);
  if (!(await verifiedTechnicianIds(actor)).includes(values.technicianId))
    throw new Error("not_authorized");
  if (new Date(values.endsAt) <= new Date(values.startsAt))
    throw new Error("time_off_end_must_be_later");
  const result = await createSupabaseAdminClient()
    .from("technician_time_off")
    .insert({
      organization_id: actor.organizationId,
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
    case "update_booking":
      return updateBooking(actor, args, call.call_id);
    case "request_style_preview":
      return requestPreview(actor, args, call.call_id);
    case "owner_booking_summary":
      return staffBookingSummary(actor, args, "owner");
    case "owner_list_bookings":
      return ownerListBookings(actor, args);
    case "owner_update_salon":
      return ownerUpdateSalon(actor, args);
    case "owner_manage_service":
      return ownerManageService(actor, args);
    case "owner_manage_technician":
      return ownerManageTechnician(actor, args);
    case "technician_list_bookings":
      return technicianBookings(actor, args);
    case "technician_booking_summary":
      return staffBookingSummary(actor, args, "technician");
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
    .eq("organization_id", actor.organizationId)
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
      organization_id: actor.organizationId,
      conversation_id: actor.conversationId,
      tool_call_id: call.call_id,
      tool_name: call.name,
      arguments: args,
      state: "started",
    },
    { onConflict: "organization_id,conversation_id,tool_call_id" },
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
    .eq("organization_id", actor.organizationId)
    .eq("tool_call_id", call.call_id);
  if (updateError) throw updateError;
  return result;
}
