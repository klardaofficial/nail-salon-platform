export type AdminBookingService = { name: string; position: number; custom: boolean };

export type AdminBookingRow = {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  salonName: string;
  salonLocation: string;
  services: string;
  serviceDetails: AdminBookingService[];
  technicianName: string | null;
  startsAt: string;
  localTimeLabel: string;
  timezone: string;
  additionalRequest: string | null;
  status: "confirmed" | "cancelled" | "checked_in";
  cancelledAt: string | null;
  cancellationReason: string | null;
  checkedInAt: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
};
