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

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return apiError("server_error", message, 500);
}
