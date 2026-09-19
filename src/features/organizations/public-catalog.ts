import "server-only";

import {
  MAX_ADDITIONAL_REQUEST_LENGTH,
  MAX_SERVICE_IDS,
  MIN_LEAD_TIME_MS,
} from "@/features/booking-intents/create";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildBookingIntentUrl } from "./providers";

export type PublicCatalog = {
  organization: { id: string; name: string };
  bookingUrl: string;
  bookingTimezone: string;
  openTime: string;
  closeTime: string;
  bookingIntervalMinutes: number;
  defaultLanguage: string;
  salonSelection: "none" | "implicit" | "required";
  rules: {
    startsAtFormat: string;
    minLeadTimeMinutes: number;
    maxServiceIds: number;
    maxAdditionalRequestLength: number;
  };
  salons: { id: string; name: string; locationLabel: string }[];
  services: { id: string; name: string; description: string | null; salonIds: string[] }[];
  technicians: { id: string; displayName: string; salonId: string }[];
};

// Returns null when the organization does not exist or is not active; the
// route layer folds both into the same 404 as a malformed organization ID
// (see docs/architecture/authorization.md "Public endpoints").
export async function readPublicCatalog(organizationId: string): Promise<PublicCatalog | null> {
  const supabase = createSupabaseAdminClient();

  const [organization, settings, salons, services, technicians] = await Promise.all([
    supabase.from("organizations").select("id,name,status").eq("id", organizationId).maybeSingle(),
    // .single(): create_organization (202609170012_create_organization_service_role.sql)
    // inserts this row atomically alongside organizations, so a missing row
    // here is corruption, not a case to silently default a timezone for.
    supabase
      .from("organization_settings")
      .select(
        "platform_timezone,default_open_time,default_close_time,default_booking_interval_minutes,bot_locale",
      )
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("salons")
      .select("id,name,location_label")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("services")
      .select(
        "id,name,description,service_salons!service_salons_organization_service_fkey(salon_id)",
      )
      .eq("organization_id", organizationId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("technicians")
      .select("id,display_name,salon_id")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("display_name"),
  ]);

  if (organization.error) throw organization.error;
  if (!organization.data || organization.data.status !== "active") return null;

  if (settings.error) throw settings.error;
  if (salons.error) throw salons.error;
  if (services.error) throw services.error;
  if (technicians.error) throw technicians.error;

  const activeSalonIds = new Set(salons.data.map((salon) => salon.id));

  // Empty service_salons means "available at every salon" (see
  // normalizeServiceSelections in conversation/tools.ts and the identical
  // rule in conversation/respond.ts). Intersecting a non-empty scope with
  // active salons must never be allowed to collapse to [] -- that would flip
  // the meaning to "available everywhere", the opposite of the truth -- so a
  // service scoped only to inactive salons is dropped instead of emitted with
  // an empty salonIds array.
  const publicServices = services.data.flatMap((service) => {
    const scope = service.service_salons ?? [];
    if (scope.length === 0) {
      return [
        { id: service.id, name: service.name, description: service.description, salonIds: [] },
      ];
    }
    const salonIds = scope
      .map((entry) => entry.salon_id)
      .filter((salonId) => activeSalonIds.has(salonId));
    if (salonIds.length === 0) return [];
    return [{ id: service.id, name: service.name, description: service.description, salonIds }];
  });

  const publicTechnicians = technicians.data
    .filter((technician) => activeSalonIds.has(technician.salon_id))
    .map((technician) => ({
      id: technician.id,
      displayName: technician.display_name,
      salonId: technician.salon_id,
    }));

  const salonSelection: PublicCatalog["salonSelection"] =
    salons.data.length === 0 ? "none" : salons.data.length === 1 ? "implicit" : "required";

  return {
    organization: { id: organization.data.id, name: organization.data.name },
    bookingUrl: buildBookingIntentUrl(organizationId),
    bookingTimezone: settings.data.platform_timezone,
    openTime: settings.data.default_open_time.slice(0, 5),
    closeTime: settings.data.default_close_time.slice(0, 5),
    bookingIntervalMinutes: settings.data.default_booking_interval_minutes,
    defaultLanguage: settings.data.bot_locale,
    salonSelection,
    rules: {
      startsAtFormat: "YYYY-MM-DDTHH:mm",
      minLeadTimeMinutes: MIN_LEAD_TIME_MS / (60 * 1000),
      maxServiceIds: MAX_SERVICE_IDS,
      maxAdditionalRequestLength: MAX_ADDITIONAL_REQUEST_LENGTH,
    },
    salons: salons.data.map((salon) => ({
      id: salon.id,
      name: salon.name,
      locationLabel: salon.location_label,
    })),
    services: publicServices,
    technicians: publicTechnicians,
  };
}
