import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  createAnnouncement,
  getEventAnnouncements,
} from "@/lib/services/announcement.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  targetRole: z.enum(["ALL", "PARTICIPANT", "COORDINATOR", "JUDGE"]).optional(),
  targetVenue: z.string().optional(),
  targetTeamStatus: z.string().optional(),
});

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/announcements — List all announcements
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const data = await getEventAnnouncements(event.id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/announcements");
  }
}

/**
 * POST /api/events/[slug]/announcements — Create announcement (ORGANIZER)
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
    const validated = createSchema.parse(body);

    const result = await createAnnouncement(event.id, session.user.id, validated);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/announcements");
  }
}
