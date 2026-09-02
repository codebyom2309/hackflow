import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { deleteAnnouncement } from "@/lib/services/announcement.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * DELETE /api/events/[slug]/announcements/[id] — Delete announcement
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, id } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");
    await deleteAnnouncement(id);

    return NextResponse.json({ message: "Announcement deleted" });
  } catch (error) {
    return handleApiError(error, "DELETE /api/events/[slug]/announcements/[id]");
  }
}
