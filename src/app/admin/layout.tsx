import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AdminProviders } from "@/components/admin/admin-providers";

import "antd/dist/reset.css";
import "../globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Nail Salon Platform Admin",
  description: "Platform operations and salon usage dashboard",
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <AdminProviders>{children}</AdminProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
