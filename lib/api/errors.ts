import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "INVALID_API_KEY"
  | "MISSING_REQUIRED_FIELD"
  | "USER_NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
  | "PLAN_LIMIT_REACHED"
  | "INTERNAL_ERROR";

export function apiError(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
