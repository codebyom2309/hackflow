import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guards";

/**
 * Standardized API error handler.
 * Wrap route handlers with this for consistent error responses.
 */
export function handleApiError(error: unknown, context: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.issues,
      },
      { status: 400 }
    );
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    if (error.message.startsWith("Invalid transition")) {
      return NextResponse.json(
        { error: error.message, code: "STATE_ERROR" },
        { status: 409 }
      );
    }

    if (error.message.includes("not found") || error.message.includes("Not found")) {
      return NextResponse.json(
        { error: error.message, code: "NOT_FOUND" },
        { status: 404 }
      );
    }
  }

  console.error(`[${context}]`, error);
  return NextResponse.json(
    { error: "Internal server error", code: "SERVER_ERROR" },
    { status: 500 }
  );
}

/**
 * Success response helper.
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/**
 * Success response with message.
 */
export function apiMessage(message: string, status = 200) {
  return NextResponse.json({ message }, { status });
}
