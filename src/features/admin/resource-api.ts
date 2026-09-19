import "server-only";

import { z } from "zod";

import type { ResourceName } from "./resources";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const commonId = z.object({ id: z.uuid() });

const schemas = {
  salons: z.object({
    name: z.string().trim().min(1).max(120),
    location_label: z.string().trim().min(1).max(300),
    timezone: z.string().trim().min(1).max(80).default("Europe/Berlin"),
    open_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .default("09:00"),
    close_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .default("18:00"),
    active: z.boolean().default(true),
  }),
  services: z.object({
    salon_ids: z.array(z.uuid()).max(100).nullable().optional(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    // Nullable, no default: null means "not set" and stays distinct from a
    // genuinely free (0) or instant (nonsensical, so min(1)) service.
    price: z.coerce.number().min(0).max(99999999.99).nullable().optional(),
    duration_minutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
    active: z.boolean().default(true),
  }),
  technicians: z.object({
    salon_id: z.uuid(),
    display_name: z.string().trim().min(1).max(120),
    wa_id: z.string().trim().min(5).max(32),
    active: z.boolean().default(true),
  }),
};

function relationName(value: unknown) {
  if (value && typeof value === "object" && "name" in value) return String(value.name);
  if (Array.isArray(value) && value[0] && typeof value[0] === "object" && "name" in value[0]) {
    return String(value[0].name);
  }
  return "";
}

function serviceSalonIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item && typeof item === "object" && "salon_id" in item && typeof item.salon_id === "string"
      ? [item.salon_id]
      : [],
  );
}

function serviceSalonNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("salon" in item)) return [];
      return [relationName(item.salon)];
    })
    .filter(Boolean);
}

async function replaceServiceSalons(
  organizationId: string,
  serviceId: string,
  salonIds?: string[] | null,
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

function serviceDatabaseValues(values: Partial<z.infer<typeof schemas.services>>) {
  return {
    ...(values.name !== undefined ? { name: values.name } : {}),
    ...(values.description !== undefined ? { description: values.description } : {}),
    ...(values.price !== undefined ? { price: values.price } : {}),
    ...(values.duration_minutes !== undefined ? { duration_minutes: values.duration_minutes } : {}),
    ...(values.active !== undefined ? { active: values.active } : {}),
  };
}

async function organizationBusinessId(organizationId: string, requireActive = true) {
  let query = createSupabaseAdminClient()
    .from("businesses")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(2);
  if (requireActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  if (data.length !== 1) throw new Error("business_setup_required");
  return data[0].id;
}

export async function listResource(organizationId: string, resource: ResourceName) {
  const supabase = createSupabaseAdminClient();

  if (resource === "salons") {
    const result = await supabase
      .from("salons")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");
    if (result.error) throw result.error;
    return {
      items: result.data.map((item) => ({
        ...item,
        open_time: item.default_open_time.slice(0, 5),
        close_time: item.default_close_time.slice(0, 5),
      })),
    };
  }

  const result =
    resource === "services"
      ? await supabase
          .from("services")
          .select(
            "*,service_salons!service_salons_organization_service_fkey(salon_id,salon:salons!service_salons_organization_salon_fkey(name))",
          )
          .eq("organization_id", organizationId)
          .order("name")
      : await supabase
          .from("technicians")
          .select("*,salon:salons!technicians_organization_salon_fkey(name)")
          .eq("organization_id", organizationId)
          .order("display_name");
  if (result.error) throw result.error;
  return {
    items: result.data.map((item) =>
      resource === "services"
        ? {
            ...item,
            salon_ids: serviceSalonIds(item.service_salons),
            salon_names: serviceSalonNames(item.service_salons).join(", ") || "All salons",
          }
        : { ...item, salon_name: relationName(item.salon) },
    ),
  };
}

export async function createResource(
  organizationId: string,
  resource: ResourceName,
  input: unknown,
) {
  const values = schemas[resource].parse(input);
  const supabase = createSupabaseAdminClient();

  if (resource === "salons") {
    const { open_time, close_time, ...salon } = values as z.infer<typeof schemas.salons>;
    const settings = await supabase
      .from("organization_settings")
      .select("default_open_time,default_close_time,default_booking_interval_minutes")
      .eq("organization_id", organizationId)
      .single();
    if (settings.error) throw settings.error;
    const result = await supabase
      .from("salons")
      .insert({
        ...salon,
        organization_id: organizationId,
        business_id: await organizationBusinessId(organizationId),
        default_open_time: open_time || settings.data.default_open_time,
        default_close_time: close_time || settings.data.default_close_time,
        booking_interval_minutes: settings.data.default_booking_interval_minutes,
      })
      .select("*")
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  const result =
    resource === "services"
      ? await supabase
          .from("services")
          .insert({
            organization_id: organizationId,
            ...serviceDatabaseValues(values as z.infer<typeof schemas.services>),
          })
          .select("*")
          .single()
      : await supabase
          .from("technicians")
          .insert({
            organization_id: organizationId,
            ...(values as z.infer<typeof schemas.technicians>),
          })
          .select("*")
          .single();
  if (result.error) throw result.error;
  if (resource === "services")
    await replaceServiceSalons(
      organizationId,
      result.data.id,
      (values as z.infer<typeof schemas.services>).salon_ids,
    );
  return result.data;
}

export async function updateResource(
  organizationId: string,
  resource: ResourceName,
  input: unknown,
) {
  const id = commonId.parse(input).id;
  const values = schemas[resource].partial().parse(input);
  const supabase = createSupabaseAdminClient();

  if (resource === "salons") {
    const { open_time, close_time, ...salon } = values as Partial<z.infer<typeof schemas.salons>>;
    const result = await supabase
      .from("salons")
      .update({
        ...salon,
        ...(open_time ? { default_open_time: open_time } : {}),
        ...(close_time ? { default_close_time: close_time } : {}),
      })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  if (resource === "services") {
    const service = serviceDatabaseValues(values as Partial<z.infer<typeof schemas.services>>);
    const result = Object.keys(service).length
      ? await supabase
          .from("services")
          .update(service)
          .eq("id", id)
          .eq("organization_id", organizationId)
          .select("*")
          .single()
      : await supabase
          .from("services")
          .select("*")
          .eq("id", id)
          .eq("organization_id", organizationId)
          .single();
    if (result.error) throw result.error;
    if ("salon_ids" in values)
      await replaceServiceSalons(
        organizationId,
        id,
        (values as Partial<z.infer<typeof schemas.services>>).salon_ids,
      );
    return result.data;
  }

  const result = await supabase
    .from("technicians")
    .update(values as Partial<z.infer<typeof schemas.technicians>>)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function deactivateResource(
  organizationId: string,
  resource: ResourceName,
  input: unknown,
) {
  const id = commonId.parse(input).id;
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from(resource)
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
    .single();
  if (result.error) throw result.error;
  return result.data;
}
