import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  getEventBySlug,
  updateEvent,
} from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { updateEventSchema } from "@/lib/validators/event.validators";
import { ZodError } from "zod";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug] — Get event details
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: event });
  } catch (error) {
    console.error("[GET /api/events/[slug]]", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/events/[slug] — Update event configuration (ORGANIZER only)
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Verify ORGANIZER role
    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();
    const validated = updateEventSchema.parse(body);
    await updateEvent(event.id, validated);

    return NextResponse.json({ message: "Event updated successfully" });
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
    if (
      error instanceof Error &&
      error.name === "AuthError"
    ) {
      return NextResponse.json(
        { error: error.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    console.error("[PATCH /api/events/[slug]]", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
