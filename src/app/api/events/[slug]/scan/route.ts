import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { validateQRPayload } from "@/lib/services/qr.service";
import { db } from "@/lib/db";
import { teams, attendanceRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { handleApiError } from "@/lib/api/response";
import crypto from "crypto";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/events/[slug]/scan — Universal QR scan endpoint
 * Role-based routing:
 *   COORDINATOR → Check-in / attendance
 *   JUDGE → Load judging form
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

    // Must be COORDINATOR or JUDGE
    const membership = await requireRole(
      session.user.id,
      event.id,
      "ORGANIZER",
      "COORDINATOR",
      "JUDGE"
    );

    const { payload } = await request.json();
    if (!payload || typeof payload !== "string") {
      return NextResponse.json(
        { error: "Invalid QR payload" },
        { status: 400 }
      );
    }

    // Validate QR
    const parsed = validateQRPayload(payload, event.qrSecret);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid or tampered QR code", code: "QR_INVALID" },
        { status: 400 }
      );
    }

    // Verify event match
    if (parsed.eventId !== event.id) {
      return NextResponse.json(
        { error: "QR code belongs to a different event", code: "QR_WRONG_EVENT" },
        { status: 400 }
      );
    }

    // Fetch team
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, parsed.teamId),
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found", code: "TEAM_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Route based on scanner role
    const scannerRole = membership.role;

    if (scannerRole === "COORDINATOR" || scannerRole === "ORGANIZER") {
      const { recordCheckIn } = await import("@/lib/services/attendance.service");
      const checkInResult = await recordCheckIn(
        event.id,
        team.id,
        session.user.id,
        "QR_SCAN"
      );

      return NextResponse.json({
        data: {
          action: "CHECK_IN",
          alreadyCheckedIn: checkInResult.alreadyCheckedIn,
          team: {
            id: team.id,
            name: team.name,
            memberCount: team.memberCount,
            status: checkInResult.team.status,
            deskId: checkInResult.team.deskId,
          },
          desk: checkInResult.desk,
          attendanceId: checkInResult.recordId || (checkInResult as any).record?.id,
        },
      });
    }

    if (scannerRole === "JUDGE") {
      // Judge flow: return team info for judging
      return NextResponse.json({
        data: {
          action: "JUDGE",
          team: {
            id: team.id,
            name: team.name,
            memberCount: team.memberCount,
            status: team.status,
            deskId: team.deskId,
          },
        },
      });
    }

    return NextResponse.json({
      data: { action: "VIEW", team },
    });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/scan");
  }
}
