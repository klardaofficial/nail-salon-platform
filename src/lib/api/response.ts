import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string; details?: unknown } };

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data }, init);
}

export function apiError(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiFailure>(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

export function apiException(error: unknown) {
  if (error instanceof ZodError) {
    return apiError("validation_error", "The submitted data is invalid", 422, error.issues);
  }

  let message = "Unexpected server error";
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const detail = record.detail;
    if (typeof record.message === "string" && record.message) message = record.message;
    else if (detail && typeof detail === "object") {
      const detailMessage = (detail as Record<string, unknown>).message;
      if (typeof detailMessage === "string" && detailMessage) message = detailMessage;
    } else if (typeof detail === "string" && detail) message = detail;
  }
  return apiError("server_error", message, 500);
}
