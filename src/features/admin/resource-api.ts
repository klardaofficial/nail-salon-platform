import "server-only";

import { z } from "zod";

import type { ResourceName } from "./resources";
import { getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const commonId = z.object({ id: z.uuid() });

const schemas = {
  businesses: z.object({
    name: z.string().trim().min(1).max(120),
    reporting_timezone: z.string().trim().min(1).max(80).default("Europe/Berlin"),
    owner_wa_ids: z.string().optional(),
  }),
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
    salon_id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
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

function normalizeOwnerIds(value?: string) {
  return [
    ...new Set(
      (value ?? "")
        .split(/[\n,]/)
        .map((item) => item.trim().replace(/^\+/, ""))
        .filter(Boolean),
    ),
  ];
}

async function syncOwners(businessId: string, ownerText?: string) {
  if (ownerText === undefined) return;
  const supabase = createSupabaseAdminClient();
  const ownerIds = normalizeOwnerIds(ownerText);
  const contactIds: string[] = [];

  for (const waId of ownerIds) {
    const { data, error } = await supabase
      .from("contacts")
      .upsert({ wa_id: waId, normalized_phone: `+${waId}` }, { onConflict: "wa_id" })
      .select("id")
      .single();
    if (error) throw error;
    contactIds.push(data.id);
  }

  const { error: removeError } = await supabase
    .from("business_owners")
    .delete()
    .eq("business_id", businessId);
  if (removeError) throw removeError;
  if (contactIds.length) {
    const { error: addError } = await supabase
      .from("business_owners")
      .insert(contactIds.map((contactId) => ({ business_id: businessId, contact_id: contactId })));
    if (addError) throw addError;
  }
}

async function singleBusinessId(requireActive = true) {
  let query = createSupabaseAdminClient().from("businesses").select("id").limit(2);
  if (requireActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  if (data.length !== 1) throw new Error("business_setup_required");
  return data[0].id;
}

export async function listResource(resource: ResourceName) {
  const supabase = createSupabaseAdminClient();

  if (resource === "businesses") {
    const [businesses, owners] = await Promise.all([
      supabase.from("businesses").select("*").order("name"),
      supabase.from("business_owners").select("business_id,contact:contacts(wa_id)"),
    ]);
    if (businesses.error) throw businesses.error;
    if (owners.error) throw owners.error;

    return {
      items: businesses.data.map((business) => {
        const businessOwners = owners.data.filter((owner) => owner.business_id === business.id);
        return {
          ...business,
          owner_wa_ids: businessOwners
            .map((owner) => {
              const contact = owner.contact as { wa_id?: string } | { wa_id?: string }[] | null;
              if (Array.isArray(contact)) return contact[0]?.wa_id ?? "";
              return contact?.wa_id ?? "";
            })
            .filter(Boolean)
            .join("\n"),
        };
      }),
    };
  }

  if (resource === "salons") {
    const result = await supabase.from("salons").select("*").order("name");
    if (result.error) throw result.error;
    return {
      items: result.data.map((item) => ({
        ...item,
        open_time: item.default_open_time.slice(0, 5),
        close_time: item.default_close_time.slice(0, 5),
      })),
    };
  }

  const result = await supabase
    .from(resource)
    .select("*,salon:salons(name)")
    .order(resource === "technicians" ? "display_name" : "name");
  if (result.error) throw result.error;
  return {
    items: result.data.map((item) => ({ ...item, salon_name: relationName(item.salon) })),
  };
}

export async function createResource(resource: ResourceName, input: unknown) {
  const values = schemas[resource].parse(input);
  const supabase = createSupabaseAdminClient();

  if (resource === "businesses") {
    const existing = await supabase.from("businesses").select("id").limit(1);
    if (existing.error) throw existing.error;
    if (existing.data.length) throw new Error("single_business_already_exists");
    const { owner_wa_ids, ...business } = values as z.infer<typeof schemas.businesses>;
    const result = await supabase.from("businesses").insert(business).select("*").single();
    if (result.error) throw result.error;
    await syncOwners(result.data.id, owner_wa_ids);
    return result.data;
  }

  if (resource === "salons") {
    const { open_time, close_time, ...salon } = values as z.infer<typeof schemas.salons>;
    const settings = getServerEnv();
    const result = await supabase
      .from("salons")
      .insert({
        ...salon,
        business_id: await singleBusinessId(),
        default_open_time: open_time || settings.DEFAULT_OPEN_TIME,
        default_close_time: close_time || settings.DEFAULT_CLOSE_TIME,
        booking_interval_minutes: settings.DEFAULT_BOOKING_INTERVAL_MINUTES,
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
          .insert(values as z.infer<typeof schemas.services>)
          .select("*")
          .single()
      : await supabase
          .from("technicians")
          .insert(values as z.infer<typeof schemas.technicians>)
          .select("*")
          .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function updateResource(resource: ResourceName, input: unknown) {
  const id = commonId.parse(input).id;
  const values = schemas[resource].partial().parse(input);
  const supabase = createSupabaseAdminClient();

  if (resource === "businesses") {
    const { owner_wa_ids, ...business } = values as Partial<z.infer<typeof schemas.businesses>>;
    const result = await supabase
      .from("businesses")
      .update(business)
      .eq("id", id)
      .select("*")
      .single();
    if (result.error) throw result.error;
    await syncOwners(id, owner_wa_ids);
    return result.data;
  }

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
      .select("*")
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  const result =
    resource === "services"
      ? await supabase
          .from("services")
          .update(values as Partial<z.infer<typeof schemas.services>>)
          .eq("id", id)
          .select("*")
          .single()
      : await supabase
          .from("technicians")
          .update(values as Partial<z.infer<typeof schemas.technicians>>)
          .eq("id", id)
          .select("*")
          .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function deactivateResource(resource: ResourceName, input: unknown) {
  const id = commonId.parse(input).id;
  const supabase = createSupabaseAdminClient();
  const result = await supabase
    .from(resource)
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (result.error) throw result.error;
  return result.data;
}
