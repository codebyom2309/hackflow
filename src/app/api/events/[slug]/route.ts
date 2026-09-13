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

    const { getUserEventRole } = await import("@/lib/auth/guards");
    let userRole = await getUserEventRole(session.user.id, event.id);

    if (!userRole) {
      const { db } = await import("@/lib/db");
      const { teams, teamMembers } = await import("@/lib/db/schema");
      const { eq, and, or } = await import("drizzle-orm");

      const userEmail = session.user.email;
      const isLeader = await db.query.teams.findFirst({
        where: and(
          eq(teams.eventId, event.id),
          userEmail
            ? or(eq(teams.leaderId, session.user.id), eq(teams.leaderEmail, userEmail))
            : eq(teams.leaderId, session.user.id)
        ),
      });

      if (isLeader) {
        userRole = "PARTICIPANT" as any;
      } else if (userEmail) {
        const memberRows = await db.query.teamMembers.findMany({
          where: eq(teamMembers.email, userEmail),
        });
        if (memberRows.length > 0) {
          const { inArray } = await import("drizzle-orm");
          const matchingTeam = await db.query.teams.findFirst({
            where: and(
              eq(teams.eventId, event.id),
              inArray(teams.id, memberRows.map((m) => m.teamId))
            ),
          });
          if (matchingTeam) {
            userRole = "PARTICIPANT" as any;
          }
        }
      }
    }

    return NextResponse.json({ data: { ...event, userRole } });
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

    if (body.status && body.status !== event.status) {
      const { changeEventStatus } = await import("@/lib/services/event.service");
      await changeEventStatus(event.id, body.status);
    }

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
