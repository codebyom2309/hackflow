import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { calculateRankings } from "@/lib/services/judgment.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId]/rankings — Get ranked leaderboard
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const rankings = await calculateRankings(event.id, roundId);
    return NextResponse.json({ data: rankings });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]/rankings");
  }
}
