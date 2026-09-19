export type PublicCatalog = {
  organization: { id: string; name: string };
  bookingUrl: string;
  bookingTimezone: string;
  openTime: string;
  closeTime: string;
  bookingIntervalMinutes: number;
  defaultLanguage: string;
  currency: { code: string; name: string; symbol: string };
  salonSelection: "none" | "implicit" | "required";
  rules: {
    startsAtFormat: string;
    minLeadTimeMinutes: number;
    maxServiceIds: number;
    maxAdditionalRequestLength: number;
  };
  salons: { id: string; name: string; locationLabel: string }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    durationMinutes: number | null;
    salonIds: string[];
  }[];
  technicians: { id: string; displayName: string; salonId: string }[];
};
