"use client";

import { AdminProviders } from "@/components/admin/admin-providers";
import { AdminClientBoundary } from "@/components/admin/admin-client-boundary";

import "antd/dist/reset.css";
import "../globals.css";
import "./admin.css";

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AdminProviders>
          <AdminClientBoundary>{children}</AdminClientBoundary>
        </AdminProviders>
      </body>
    </html>
  );
}
