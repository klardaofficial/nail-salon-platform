import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "../globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-marketing",
});

export const metadata: Metadata = {
  title: "Nagelzeit | WhatsApp-Plattform für Nail-Studios",
  description:
    "Buchungen, Kundenservice und Nail-Style-Vorschauen per WhatsApp für moderne Nail-Studios.",
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
