export type ResourceName = "salons" | "services" | "technicians";

export type AdminResourceItem = Record<
  string,
  string | string[] | number | boolean | null | undefined
> & {
  id: string;
};

export type ResourceResponse = { items: AdminResourceItem[] };

export type ResourceField = {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "select" | "multiselect" | "switch" | "time";
  required?: boolean;
  optionSource?: "salons";
  help?: string;
};

export type ResourceDefinition = {
  title: string;
  description: string;
  singular: string;
  columns: { key: string; label: string; kind?: "boolean" | "date" }[];
  fields: ResourceField[];
  defaults?: Record<string, string | boolean>;
};

export const resourceDefinitions: Record<ResourceName, ResourceDefinition> = {
  salons: {
    title: "Salons",
    description: "Manage physical locations and the defaults used in WhatsApp bookings.",
    singular: "salon",
    columns: [
      { key: "name", label: "Salon" },
      { key: "location_label", label: "Location" },
      { key: "timezone", label: "Timezone" },
      { key: "active", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "name", label: "Salon name", required: true },
      { name: "location_label", label: "Location", required: true },
      { name: "timezone", label: "Timezone", required: true },
      { name: "open_time", label: "Opening time", kind: "time", required: true },
      { name: "close_time", label: "Closing time", kind: "time", required: true },
      { name: "active", label: "Active", kind: "switch" },
    ],
    defaults: {
      timezone: "Europe/Berlin",
      open_time: "09:00",
      close_time: "18:00",
      active: true,
    },
  },
  services: {
    title: "Services",
    description:
      "Optional reference services. Leave salon locations empty to offer a service at all salons.",
    singular: "service",
    columns: [
      { key: "name", label: "Service" },
      { key: "salon_names", label: "Available at" },
      { key: "description", label: "Description" },
      { key: "active", label: "Active", kind: "boolean" },
    ],
    fields: [
      {
        name: "salon_ids",
        label: "Salon locations",
        kind: "multiselect",
        optionSource: "salons",
        help: "Leave empty to make this service available at all salons.",
      },
      { name: "name", label: "Service name", required: true },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "active", label: "Active", kind: "switch" },
    ],
    defaults: { active: true },
  },
  technicians: {
    title: "Technicians",
    description: "Manage optional technician choices and WhatsApp notification recipients.",
    singular: "technician",
    columns: [
      { key: "display_name", label: "Name" },
      { key: "salon_name", label: "Salon" },
      { key: "wa_id", label: "WhatsApp ID" },
      { key: "active", label: "Active", kind: "boolean" },
    ],
    fields: [
      {
        name: "salon_id",
        label: "Salon",
        kind: "select",
        optionSource: "salons",
        required: true,
      },
      { name: "display_name", label: "Display name", required: true },
      { name: "wa_id", label: "WhatsApp ID or number", required: true },
      { name: "active", label: "Active", kind: "switch" },
    ],
    defaults: { active: true },
  },
};
