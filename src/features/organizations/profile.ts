import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function normalizeOwnerIds(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim().replace(/^\+/, ""))
        .filter(Boolean),
    ),
  ];
}

export async function readOrganizationProfile(organizationId: string) {
  const supabase = createSupabaseAdminClient();
  const business = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", organizationId)
    .single();
  if (business.error) throw business.error;

  const owners = await supabase
    .from("business_owners")
    .select("contact:contacts!business_owners_organization_contact_fkey(wa_id)")
    .eq("organization_id", organizationId)
    .eq("business_id", business.data.id);
  if (owners.error) throw owners.error;

  return {
    businessId: business.data.id,
    ownerWaIds: owners.data
      .map((owner) => {
        const contact = owner.contact as { wa_id?: string } | { wa_id?: string }[] | null;
        return Array.isArray(contact) ? (contact[0]?.wa_id ?? "") : (contact?.wa_id ?? "");
      })
      .filter(Boolean)
      .join("\n"),
  };
}

export async function updateOrganizationProfile(
  organizationId: string,
  values: { organizationName?: string; ownerWaIds?: string },
) {
  const supabase = createSupabaseAdminClient();
  const profile = await readOrganizationProfile(organizationId);

  if (values.organizationName !== undefined) {
    const organization = await supabase
      .from("organizations")
      .update({ name: values.organizationName })
      .eq("id", organizationId);
    if (organization.error) throw organization.error;

    const business = await supabase
      .from("businesses")
      .update({ name: values.organizationName })
      .eq("organization_id", organizationId)
      .eq("id", profile.businessId);
    if (business.error) throw business.error;
  }

  if (values.ownerWaIds === undefined) return;
  const contactIds: string[] = [];
  for (const waId of normalizeOwnerIds(values.ownerWaIds)) {
    const contact = await supabase
      .from("contacts")
      .upsert(
        { organization_id: organizationId, wa_id: waId, normalized_phone: `+${waId}` },
        { onConflict: "organization_id,wa_id" },
      )
      .select("id")
      .single();
    if (contact.error) throw contact.error;
    contactIds.push(contact.data.id);
  }

  const removed = await supabase
    .from("business_owners")
    .delete()
    .eq("organization_id", organizationId)
    .eq("business_id", profile.businessId);
  if (removed.error) throw removed.error;

  if (contactIds.length) {
    const added = await supabase.from("business_owners").insert(
      contactIds.map((contactId) => ({
        organization_id: organizationId,
        business_id: profile.businessId,
        contact_id: contactId,
      })),
    );
    if (added.error) throw added.error;
  }
}
