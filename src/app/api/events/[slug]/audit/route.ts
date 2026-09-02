import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { getEventAuditLogs } from "@/lib/services/audit.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/audit — List audit logs (ORGANIZER only)
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

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 500);

    const logs = await getEventAuditLogs(event.id, limit);
    return NextResponse.json({ data: logs });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/audit");
  }
}
