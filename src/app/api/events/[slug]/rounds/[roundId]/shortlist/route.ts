import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  computeShortlist,
  getShortlist,
  publishResults,
} from "@/lib/services/shortlist.service";
import { getRoundById } from "@/lib/services/round.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const shortlistSchema = z.object({
  shortlistCount: z.number().int().min(1),
});

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId]/shortlist — Get shortlist
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

    const data = await getShortlist(roundId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]/shortlist");
  }
}

/**
 * POST /api/events/[slug]/rounds/[roundId]/shortlist — Compute shortlist from rankings
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();

    // Use shortlistCount from body or from round config
    let shortlistCount: number;
    if (body.shortlistCount) {
      const validated = shortlistSchema.parse(body);
      shortlistCount = validated.shortlistCount;
    } else {
      const round = await getRoundById(roundId);
      if (!round?.shortlistCount) {
        return NextResponse.json(
          { error: "shortlistCount not configured on round. Pass it in the request body." },
          { status: 400 }
        );
      }
      shortlistCount = round.shortlistCount;
    }

    const result = await computeShortlist(event.id, roundId, shortlistCount);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/rounds/[roundId]/shortlist");
  }
}
