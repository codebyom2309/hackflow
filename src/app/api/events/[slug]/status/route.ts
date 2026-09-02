import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  getEventBySlug,
  changeEventStatus,
} from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { changeEventStatusSchema } from "@/lib/validators/event.validators";
import { ZodError } from "zod";

type Params = { params: Promise<{ slug: string }> };

/**
 * PATCH /api/events/[slug]/status — Change event state (ORGANIZER only)
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
    const validated = changeEventStatusSchema.parse(body);
    const result = await changeEventStatus(event.id, validated.status);

    return NextResponse.json({
      data: result,
      message: `Event status changed: ${result.previousStatus} → ${result.newStatus}`,
    });
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
    if (error instanceof Error) {
      if (error.name === "AuthError") {
        return NextResponse.json(
          { error: error.message, code: "FORBIDDEN" },
          { status: 403 }
        );
      }
      if (error.message.startsWith("Invalid transition")) {
        return NextResponse.json(
          { error: error.message, code: "STATE_ERROR" },
          { status: 409 }
        );
      }
    }
    console.error("[PATCH /api/events/[slug]/status]", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
