import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { createEvent, getUserEvents } from "@/lib/services/event.service";
import { createEventSchema } from "@/lib/validators/event.validators";
import { ZodError } from "zod";

/**
 * POST /api/events — Create a new event
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = createEventSchema.parse(body);
    const result = await createEvent(session.user.id, validated);

    return NextResponse.json(
      { data: result, message: "Event created successfully" },
      { status: 201 }
    );
  } catch (error) {
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
    console.error("[POST /api/events]", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/events — List user's events
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const userEvents = await getUserEvents(session.user.id);
    return NextResponse.json({ data: userEvents });
  } catch (error) {
    console.error("[GET /api/events]", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
