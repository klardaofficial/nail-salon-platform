export type ResourceName = "businesses" | "salons" | "services" | "technicians";

export type AdminResourceItem = Record<string, string | number | boolean | null | undefined> & {
  id: string;
};

export type ResourceResponse = { items: AdminResourceItem[] };

export type ResourceField = {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "select" | "switch" | "time";
  required?: boolean;
  optionSource?: "businesses" | "salons";
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
  businesses: {
    title: "Businesses",
    description: "Group salons, owners, and monthly reporting under one business account.",
    singular: "business",
    columns: [
      { key: "name", label: "Name" },
      { key: "reporting_timezone", label: "Reporting timezone" },
      { key: "salon_count", label: "Salons" },
      { key: "owner_count", label: "Owners" },
      { key: "active", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "name", label: "Business name", required: true },
      { name: "reporting_timezone", label: "Reporting timezone", required: true },
      {
        name: "owner_wa_ids",
        label: "Owner WhatsApp IDs",
        kind: "textarea",
        help: "Enter one WhatsApp ID or international number per line.",
      },
      { name: "active", label: "Active", kind: "switch" },
    ],
    defaults: { reporting_timezone: "Europe/Berlin", active: true },
  },
  salons: {
    title: "Salons",
    description: "Manage physical locations and the defaults used in WhatsApp bookings.",
    singular: "salon",
    columns: [
      { key: "name", label: "Salon" },
      { key: "business_name", label: "Business" },
      { key: "location_label", label: "Location" },
      { key: "timezone", label: "Timezone" },
      { key: "active", label: "Active", kind: "boolean" },
    ],
    fields: [
      {
        name: "business_id",
        label: "Business",
        kind: "select",
        optionSource: "businesses",
        required: true,
      },
      { name: "name", label: "Salon name", required: true },
      { name: "location_label", label: "Location", required: true },
      { name: "timezone", label: "Timezone", required: true },
      { name: "open_time", label: "Opening time", kind: "time", required: true },
      { name: "close_time", label: "Closing time", kind: "time", required: true },
      {
        name: "customer_can_choose_technician",
        label: "Customers can choose a technician",
        kind: "switch",
      },
      { name: "active", label: "Active", kind: "switch" },
    ],
    defaults: {
      timezone: "Europe/Berlin",
      open_time: "09:00",
      close_time: "18:00",
      customer_can_choose_technician: false,
      active: true,
    },
  },
  services: {
    title: "Services",
    description: "Optional salon services shown as helpful choices in natural conversations.",
    singular: "service",
    columns: [
      { key: "name", label: "Service" },
      { key: "salon_name", label: "Salon" },
      { key: "description", label: "Description" },
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
