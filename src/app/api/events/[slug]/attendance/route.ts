import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getAttendanceRoster,
  recordCheckIn,
} from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const manualCheckInSchema = z.object({
  teamId: z.string().uuid("Invalid team ID"),
});

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/attendance — Get attendance roster and stats
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const data = await getAttendanceRoster(event.id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/attendance");
  }
}

/**
 * POST /api/events/[slug]/attendance — Manual check-in by staff
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const body = await request.json();
    const validated = manualCheckInSchema.parse(body);

    const result = await recordCheckIn(
      event.id,
      validated.teamId,
      session.user.id,
      "MANUAL"
    );

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/attendance");
  }
}
