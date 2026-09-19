"use client";

import { Segmented } from "antd";
import { useState } from "react";
import { BookingSiteSimulatorClient } from "./booking-site-simulator-client";
import { PageHeading } from "./page-heading";
import { SimulatorClient } from "./simulator-client";

const TABS = {
  whatsapp: {
    label: "WhatsApp",
    title: "WhatsApp simulator",
    description: "Try customer, owner, and technician conversations side by side.",
  },
  booking: {
    label: "Booking site",
    title: "Booking site simulator",
    description:
      "Stand in for an external booking website: read the public catalog, pick options, and get the hand-off URL.",
  },
} as const;

type Tab = keyof typeof TABS;

export function SimulatorTabs({ organizationId }: { organizationId: string }) {
  const [tab, setTab] = useState<Tab>("whatsapp");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading title={TABS[tab].title} description={TABS[tab].description} />
        <Segmented
          aria-label="Simulator mode"
          size="large"
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          options={Object.entries(TABS).map(([value, { label }]) => ({ value, label }))}
        />
      </div>
      {tab === "whatsapp" ? (
        <SimulatorClient organizationId={organizationId} />
      ) : (
        <BookingSiteSimulatorClient organizationId={organizationId} />
      )}
    </>
  );
}
