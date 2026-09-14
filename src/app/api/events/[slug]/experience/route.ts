import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import {
  getParticipantExperience,
  saveParticipantExperience,
} from "@/lib/services/participant-experience.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/experience
 * Returns participant-facing experience configuration
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const data = await getParticipantExperience(event.id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/experience");
  }
}

/**
 * POST /api/events/[slug]/experience
 * Organizer saves draft or publishes participant-facing experience
 */
export async function POST(request: Request, { params }: Params) {
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

    // ORGANIZER only
    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();
    const { config, publish } = body;

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "Invalid experience configuration payload", code: "INVALID_CONFIG" },
        { status: 400 }
      );
    }

    const saved = await saveParticipantExperience(event.id, config, Boolean(publish));

    return NextResponse.json({
      data: saved,
      message: publish
        ? "Participant experience published successfully!"
        : "Participant experience draft saved.",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/experience");
  }
}
