import type { SimulatorIdentity, SimulatorSendInput } from "./contracts";

export type OwnerMapping = {
  contact: { wa_id: string; display_name: string | null };
  business: { name: string };
};
export type TechnicianMapping = {
  wa_id: string;
  display_name: string;
  salon: { name: string };
};

export class SimulatorIdentityError extends Error {}

export function groupSimulatorIdentities(owners: OwnerMapping[], technicians: TechnicianMapping[]) {
  const identities = new Map<string, SimulatorIdentity>();
  for (const owner of owners) {
    const waId = owner.contact.wa_id;
    const actor = identities.get(waId) ?? {
      waId,
      name: owner.contact.display_name || `Owner ${waId}`,
      roles: [],
      businesses: [],
      salons: [],
    };
    if (!actor.roles.includes("owner")) actor.roles.push("owner");
    if (!actor.businesses.includes(owner.business.name)) actor.businesses.push(owner.business.name);
    identities.set(waId, actor);
  }
  for (const technician of technicians) {
    const actor = identities.get(technician.wa_id) ?? {
      waId: technician.wa_id,
      name: technician.display_name,
      roles: [],
      businesses: [],
      salons: [],
    };
    if (actor.name === `Owner ${actor.waId}`) actor.name = technician.display_name;
    if (!actor.roles.includes("technician")) actor.roles.push("technician");
    if (!actor.salons.includes(technician.salon.name)) actor.salons.push(technician.salon.name);
    identities.set(actor.waId, actor);
  }
  return [...identities.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveSimulatorIdentity(
  identity: SimulatorSendInput["identity"],
  actors: SimulatorIdentity[],
) {
  const actor = actors.find((item) => item.waId === identity.waId);
  if (identity.kind === "staff") {
    if (!actor)
      throw new SimulatorIdentityError(
        "This owner or technician mapping no longer exists. Refresh the identities.",
      );
    return { waId: actor.waId, name: actor.name };
  }
  if (actor)
    throw new SimulatorIdentityError(
      "This WhatsApp ID belongs to an owner or technician. Use its database chat window.",
    );
  return { waId: identity.waId, name: identity.name };
}
