"use client";

import { Skeleton } from "antd";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => undefined;

export function AdminClientBoundary({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return isClient ? children : <Skeleton active paragraph={{ rows: 8 }} />;
}
