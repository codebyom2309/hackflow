import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { publishResults } from "@/lib/services/shortlist.service";
import { getRoundById } from "@/lib/services/round.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * POST /api/events/[slug]/rounds/[roundId]/shortlist/publish — Publish results
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const round = await getRoundById(roundId);
    if (!round)
      return NextResponse.json({ error: "Round not found" }, { status: 404 });

    if (!round.shortlistCount) {
      return NextResponse.json(
        { error: "shortlistCount not configured on round" },
        { status: 400 }
      );
    }

    const result = await publishResults(roundId, round.shortlistCount);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/rounds/[roundId]/shortlist/publish");
  }
}
