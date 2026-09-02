import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  submitProject,
  getTeamSubmission,
  getRoundSubmissions,
} from "@/lib/services/submission.service";
import { getRegistration } from "@/lib/services/registration.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const submitSchema = z.object({
  githubUrl: z.string().url().optional(),
  problemStatementId: z.string().optional(),
  pptFileKey: z.string().optional(),
  pptFilename: z.string().optional(),
  pptFileSize: z.number().int().optional(),
});

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId]/submissions
 * - Participants: get own team's submission
 * - Organizer/Coordinator: get all submissions for the round
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

    // Check role
    const membership = await db.query.eventMemberships.findFirst({
      where: and(
        eq(eventMemberships.userId, session.user.id),
        eq(eventMemberships.eventId, event.id)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this event" }, { status: 403 });
    }

    if (membership.role === "ORGANIZER" || membership.role === "COORDINATOR") {
      const all = await getRoundSubmissions(roundId);
      return NextResponse.json({ data: all });
    }

    // Participant: get own submission
    const reg = await getRegistration(session.user.id, event.id);
    if (!reg?.team) {
      return NextResponse.json({ error: "No team found" }, { status: 404 });
    }

    const sub = await getTeamSubmission(reg.team.id, roundId);
    return NextResponse.json({ data: sub || null });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]/submissions");
  }
}

/**
 * POST /api/events/[slug]/rounds/[roundId]/submissions — Submit project
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Must be a registered participant
    const reg = await getRegistration(session.user.id, event.id);
    if (!reg?.team) {
      return NextResponse.json(
        { error: "Only registered team leaders can submit" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = submitSchema.parse(body);

    const result = await submitProject(event.id, roundId, reg.team.id, validated);
    return NextResponse.json({ data: result }, { status: result.updated ? 200 : 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/rounds/[roundId]/submissions");
  }
}
