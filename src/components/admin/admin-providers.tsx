"use client";

import { App, ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { apiGet } from "@/lib/api/client";

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={enUS}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#a62f5c",
          colorInfo: "#a62f5c",
          borderRadius: 10,
          fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Layout: { bodyBg: "#f4f6f8", headerBg: "#ffffff", siderBg: "#ffffff" },
          Menu: { itemBorderRadius: 8, itemSelectedBg: "#f7e8ee", itemSelectedColor: "#862047" },
        },
      }}
    >
      <App>
        <SWRConfig
          value={{
            fetcher: apiGet,
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            dedupingInterval: 2_000,
          }}
        >
          {children}
        </SWRConfig>
      </App>
    </ConfigProvider>
  );
}
