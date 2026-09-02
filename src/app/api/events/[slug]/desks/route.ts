import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getRoomDesks,
  bulkCreateDesks,
} from "@/lib/services/desk.service";
import { bulkCreateDesksSchema } from "@/lib/validators/venue.validators";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/desks — List all desks for event (with team info)
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

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId query parameter required" },
        { status: 400 }
      );
    }

    const deskList = await getRoomDesks(roomId);
    return NextResponse.json({ data: deskList });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/desks");
  }
}

/**
 * POST /api/events/[slug]/desks — Bulk create desks
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
    const validated = bulkCreateDesksSchema.parse(body);
    const result = await bulkCreateDesks(event.id, validated);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/desks");
  }
}
