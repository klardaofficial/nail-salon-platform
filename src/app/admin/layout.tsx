"use client";

import { AdminProviders } from "@/components/admin/admin-providers";
import { AdminClientBoundary } from "@/components/admin/admin-client-boundary";

import "antd/dist/reset.css";
import "./admin.css";

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-admin-bg text-admin-ink font-admin min-h-dvh min-w-80">
        <AdminProviders>
          <AdminClientBoundary>{children}</AdminClientBoundary>
        </AdminProviders>
      </body>
    </html>
  );
}
