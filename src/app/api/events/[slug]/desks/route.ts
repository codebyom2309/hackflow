import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getRoomDesks,
  bulkCreateDesks,
  reassignTeam,
  releaseDesk,
} from "@/lib/services/desk.service";
import { bulkCreateDesksSchema } from "@/lib/validators/venue.validators";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/desks — List all desks for event (with team info)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");
    const getUnseated = url.searchParams.get("unseated");

    if (getUnseated === "true") {
      const { db } = await import("@/lib/db");
      const { teams } = await import("@/lib/db/schema");
      const { eq, isNull, and, desc } = await import("drizzle-orm");

      const unseatedTeams = await db.query.teams.findMany({
        where: and(eq(teams.eventId, event.id), isNull(teams.deskId)),
        orderBy: [desc(teams.createdAt)],
        columns: {
          id: true,
          name: true,
          memberCount: true,
          status: true,
          leaderEmail: true,
          college: true,
          theme: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ data: unseatedTeams });
    }

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId query parameter required" },
        { status: 400 }
      );
    }

    const deskList = await getRoomDesks(roomId);
    return NextResponse.json({ data: deskList });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/desks");
  }
}

/**
 * POST /api/events/[slug]/desks — Bulk create desks
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();
    const validated = bulkCreateDesksSchema.parse(body);
    const result = await bulkCreateDesks(event.id, validated);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/desks");
  }
}

/**
 * PATCH /api/events/[slug]/desks — Assign, reassign or release desks
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const body = await request.json();
    const { action, teamId, deskId, newDeskId } = body;
    const targetDeskId = deskId || newDeskId;

    if (action === "assign" || action === "reassign") {
      if (!teamId || !targetDeskId) {
        return NextResponse.json(
          { error: "teamId and deskId are required for desk assignment" },
          { status: 400 }
        );
      }
      await reassignTeam(teamId, targetDeskId);
      return NextResponse.json({
        success: true,
        message: action === "assign" ? "Desk allocated successfully" : "Team reassigned",
      });
    }

    if (action === "release") {
      if (!teamId) {
        return NextResponse.json(
          { error: "teamId is required" },
          { status: 400 }
        );
      }
      await releaseDesk(teamId);
      return NextResponse.json({ success: true, message: "Desk released" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return handleApiError(error, "PATCH /api/events/[slug]/desks");
  }
}
