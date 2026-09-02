import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { getProblemStatements } from "@/lib/services/round.service";
import { handleApiError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId]/problems — Get problem statements
 * Enforces server-side reveal time for non-organizer users.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Check if user is organizer for reveal bypass
    const membership = await db.query.eventMemberships.findFirst({
      where: and(
        eq(eventMemberships.userId, session.user.id),
        eq(eventMemberships.eventId, event.id)
      ),
    });

    const isOrganizer = membership?.role === "ORGANIZER";

    const data = await getProblemStatements(roundId, isOrganizer);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]/problems");
  }
}
