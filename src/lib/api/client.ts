"use client";

import type { ApiFailure, ApiSuccess } from "@/lib/api/response";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !payload || "error" in payload) {
    const failure = payload && "error" in payload ? payload.error : null;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed",
      response.status,
      failure?.code ?? "request_failed",
      failure?.details,
    );
  }

  return payload.data;
}

export async function apiGet<T>(url: string): Promise<T> {
  return parseResponse<T>(
    await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" }),
  );
}

export async function apiMutation<T, TBody = unknown>(
  url: string,
  { arg }: { arg: { method?: "POST" | "PATCH" | "DELETE"; body?: TBody } },
): Promise<T> {
  return parseResponse<T>(
    await fetch(url, {
      method: arg.method ?? "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: arg.body === undefined ? undefined : JSON.stringify(arg.body),
    }),
  );
}
