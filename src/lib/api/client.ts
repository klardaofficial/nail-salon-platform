"use client";

import axios from "axios";

import type { ApiFailure, ApiSuccess } from "@/lib/api/response";
import type { ApiKey } from "@/lib/api/keys";

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

const apiClient = axios.create({
  headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  validateStatus: () => true,
});

function parseResponse<T>(payload: ApiSuccess<T> | ApiFailure | null, status: number): T {
  if (status < 200 || status >= 300 || !payload || "error" in payload) {
    const failure = payload && "error" in payload ? payload.error : null;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed",
      status,
      failure?.code ?? "request_failed",
      failure?.details,
    );
  }

  return payload.data;
}

export async function apiGet<T>(key: ApiKey): Promise<T> {
  const response = await apiClient.get<ApiSuccess<T> | ApiFailure>(key[1]);
  return parseResponse(response.data, response.status);
}

export async function apiMutation<T, TBody = unknown>(
  key: ApiKey,
  { arg }: { arg: { method?: "POST" | "PATCH" | "DELETE"; body?: TBody } },
): Promise<T> {
  const response = await apiClient.request<ApiSuccess<T> | ApiFailure>({
    url: key[1],
    method: arg.method ?? "POST",
    data: arg.body,
  });
  return parseResponse(response.data, response.status);
}
