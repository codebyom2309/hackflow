import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { undoCheckIn } from "@/lib/services/attendance.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * POST /api/events/[slug]/attendance/[id]/undo — Undo check-in
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug, id } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const result = await undoCheckIn(event.id, id, session.user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/attendance/[id]/undo");
  }
}
