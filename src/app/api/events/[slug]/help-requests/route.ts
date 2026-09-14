import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { getUserEventRole } from "@/lib/auth/guards";
import {
  createHelpRequest,
  getEventHelpRequests,
  getParticipantHelpRequests,
  getHelpRequestStats,
} from "@/lib/services/help-request.service";
import { getRegistration } from "@/lib/services/registration.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/help-requests
 * Role-based response:
 * - PARTICIPANT: sees their team's requests
 * - COORDINATOR / ORGANIZER: sees full event help desk queue + stats
 */
export async function GET(request: Request, { params }: Params) {
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

    const role = await getUserEventRole(session.user.id, event.id);

    // If Coordinator or Organizer -> return full event help queue
    if (role === "COORDINATOR" || role === "ORGANIZER" || event.organizerId === session.user.id) {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "ALL";
      const priority = searchParams.get("priority") || "ALL";
      const category = searchParams.get("category") || "ALL";

      const [requests, stats] = await Promise.all([
        getEventHelpRequests(event.id, { status, priority, category }),
        getHelpRequestStats(event.id),
      ]);

      return NextResponse.json({
        data: {
          requests,
          stats,
          role,
        },
      });
    }

    // If Participant -> check their team registration and return team's requests
    const reg = await getRegistration(session.user.id, event.id);
    if (!reg?.team) {
      return NextResponse.json(
        { error: "No registered team found for this participant", code: "NO_TEAM" },
        { status: 403 }
      );
    }

    const requests = await getParticipantHelpRequests(event.id, reg.team.id);

    return NextResponse.json({
      data: {
        requests,
        teamId: reg.team.id,
        role: "PARTICIPANT",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/help-requests");
  }
}

/**
 * POST /api/events/[slug]/help-requests
 * Participant creates a new support ticket
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

    // Resolve participant team
    const reg = await getRegistration(session.user.id, event.id);
    if (!reg?.team) {
      return NextResponse.json(
        {
          error: "You must be part of a registered team to request help",
          code: "REGISTRATION_REQUIRED",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { category, priority, description, location: userLocation } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Please describe your issue", code: "MISSING_DESCRIPTION" },
        { status: 400 }
      );
    }

    // Automatically construct physical location if desk is allotted
    let location = userLocation?.trim() || "";
    if (!location && reg.desk) {
      location = `${reg.desk.roomName} (Room #${reg.desk.roomNumber}) | Desk #${reg.desk.deskNumber}`;
    }

    const helpRequest = await createHelpRequest({
      eventId: event.id,
      teamId: reg.team.id,
      participantId: session.user.id,
      category: category || "TECHNICAL_ISSUE",
      priority: priority || "NORMAL",
      description: description.trim(),
      location: location || "Venue General Area",
    });

    return NextResponse.json(
      {
        data: helpRequest,
        message: "Support request submitted successfully. A volunteer will assist you shortly.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/help-requests");
  }
}
