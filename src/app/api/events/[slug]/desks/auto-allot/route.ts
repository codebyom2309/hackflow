import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { autoAllotRemaining } from "@/lib/services/desk.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/events/[slug]/desks/auto-allot — Auto-allocate waitlisted teams
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const result = await autoAllotRemaining(event.id);

    return NextResponse.json({
      data: result,
      message: `Allocated ${result.allocated} of ${result.total} waitlisted teams`,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/desks/auto-allot");
  }
}
