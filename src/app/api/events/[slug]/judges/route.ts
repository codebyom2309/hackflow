import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, getUserEventRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  assignTeamsToJudge,
  removeAssignments,
  getJudgeAssignments,
  autoDistributeTeams,
  getAssignmentMatrix,
  addEventStaffMember,
  removeEventStaffMember,
  getEventJudgesWithProgress,
  getEventCoordinators,
} from "@/lib/services/judge-assignment.service";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/judges
 * Get judges list, coordinators list, and assignment matrix.
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
    const roundId = req.nextUrl.searchParams.get("roundId") || undefined;

    if (role === "ORGANIZER") {
      const judges = await getEventJudgesWithProgress(event.id, roundId);
      const coordinators = await getEventCoordinators(event.id);
      const matrix = roundId ? await getAssignmentMatrix(event.id, roundId) : [];

      return NextResponse.json({
        data: {
          judges,
          coordinators,
          matrix,
        },
      });
    }

    if (role === "JUDGE") {
      if (!roundId) {
        return NextResponse.json({ error: "roundId required for judge assignments" }, { status: 400 });
      }
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
 * Support add-judge, add-coordinator, remove-member, auto-distribute, and assign.
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

    // 1. Add Judge
    if (body.action === "add-judge") {
      if (!body.email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      const result = await addEventStaffMember(
        event.id,
        body.email,
        body.name || "",
        "JUDGE"
      );
      return NextResponse.json({
        data: result,
        message: `Judge ${result.user?.name || result.user?.email || body.email} added successfully`,
      });
    }

    // 2. Add Coordinator
    if (body.action === "add-coordinator") {
      if (!body.email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      const result = await addEventStaffMember(
        event.id,
        body.email,
        body.name || "",
        "COORDINATOR"
      );
      return NextResponse.json({
        data: result,
        message: `Coordinator ${result.user?.name || result.user?.email || body.email} added successfully`,
      });
    }

    // 3. Remove Member (Judge or Coordinator)
    if (body.action === "remove-member") {
      if (!body.userId || !body.role) {
        return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
      }
      const result = await removeEventStaffMember(event.id, body.userId, body.role);
      return NextResponse.json({ data: result, message: `${body.role} removed successfully` });
    }

    // 4. Auto-distribute
    if (body.action === "auto-distribute") {
      if (!body.roundId) {
        return NextResponse.json({ error: "roundId required" }, { status: 400 });
      }
      const result = await autoDistributeTeams(event.id, body.roundId);
      return NextResponse.json({ data: result });
    }

    // 5. Manual assignment
    if (!body.judgeId || !body.roundId || !body.teamIds?.length) {
      return NextResponse.json(
        { error: "judgeId, roundId, and teamIds are required for assignment" },
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
