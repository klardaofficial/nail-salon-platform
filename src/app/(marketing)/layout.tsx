import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "../globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-marketing",
});

export const metadata: Metadata = {
  title: "Nagelzeit | Nail-Termine per WhatsApp",
  description:
    "Finde dein Nail-Studio, buche einen Termin per WhatsApp und probiere neue Nail-Styles auf deinem Foto.",
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
