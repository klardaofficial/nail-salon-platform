export type AdminBookingService = { name: string; position: number; custom: boolean };

export type AdminBookingRow = {
  id: string;
  customerName: string;
  salonName: string;
  services: string;
  serviceDetails: AdminBookingService[];
  technicianName: string | null;
  startsAt: string;
  localTimeLabel: string;
  timezone: string;
  additionalRequest: string | null;
  status: "confirmed" | "cancelled";
  cancelledAt: string | null;
  cancellationReason: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
};
