import { notFound } from "next/navigation";

import { SimulatorClient } from "@/components/admin/simulator-client";
import { isWhatsAppSimulatorEnabled } from "@/lib/config/env";

export default function SimulatorPage() {
  if (!isWhatsAppSimulatorEnabled()) notFound();
  return <SimulatorClient />;
}
