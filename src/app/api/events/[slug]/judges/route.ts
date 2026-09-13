import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, getUserEventRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  assignTeamsToJudge,
  removeAssignments,
  getJudgeAssignments,
  autoDistributeTeams,
  getAssignmentMatrix,
} from "@/lib/services/judge-assignment.service";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/judges
 * Get judge assignment matrix (organizer) or own assignments (judge).
 * Query: ?roundId=...
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const role = await getUserEventRole(session.user!.id!, event.id);
    const roundId = req.nextUrl.searchParams.get("roundId");

    if (!roundId) {
      return NextResponse.json({ error: "roundId required" }, { status: 400 });
    }

    if (role === "ORGANIZER") {
      const matrix = await getAssignmentMatrix(event.id, roundId);
      return NextResponse.json({ data: { matrix } });
    }

    if (role === "JUDGE") {
      const assignments = await getJudgeAssignments(session.user!.id!, roundId);
      return NextResponse.json({ data: { assignments } });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
  }
}

/**
 * POST /api/events/[slug]/judges
 * Assign teams to judges.
 * Body: { action: "assign" | "auto-distribute", judgeId?, teamIds?, roundId }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const body = await req.json();

    if (body.action === "auto-distribute") {
      if (!body.roundId) {
        return NextResponse.json({ error: "roundId required" }, { status: 400 });
      }
      const result = await autoDistributeTeams(event.id, body.roundId);
      return NextResponse.json({ data: result });
    }

    // Manual assignment
    if (!body.judgeId || !body.roundId || !body.teamIds?.length) {
      return NextResponse.json(
        { error: "judgeId, roundId, and teamIds are required" },
        { status: 400 }
      );
    }

    const result = await assignTeamsToJudge(
      event.id,
      body.judgeId,
      body.roundId,
      body.teamIds
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
  }
}

/**
 * DELETE /api/events/[slug]/judges
 * Remove assignments. Body: { judgeId, roundId, teamIds }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const body = await req.json();
    if (!body.judgeId || !body.roundId || !body.teamIds?.length) {
      return NextResponse.json({ error: "judgeId, roundId, and teamIds required" }, { status: 400 });
    }

    const result = await removeAssignments(body.judgeId, body.roundId, body.teamIds);
    return NextResponse.json({ data: result });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
  }
}
