import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getEventRooms,
  createRoom,
  getVenueStats,
} from "@/lib/services/desk.service";
import { createRoomSchema } from "@/lib/validators/venue.validators";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/rooms — List rooms with desk stats
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

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const roomsList = await getEventRooms(event.id);
    const stats = await getVenueStats(event.id);

    return NextResponse.json({ data: { rooms: roomsList, stats } });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rooms");
  }
}

/**
 * POST /api/events/[slug]/rooms — Create a room
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
    const validated = createRoomSchema.parse(body);
    const result = await createRoom(event.id, validated);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/rooms");
  }
}
