import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getEventRounds,
  createRound,
} from "@/lib/services/round.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const createRoundSchema = z.object({
  roundNumber: z.number().int().min(1),
  title: z.string().max(255).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  problemRevealAt: z.string().optional(),
  submissionDeadline: z.string().optional(),
  shortlistCount: z.number().int().min(1).optional(),
  retainDesks: z.boolean().optional(),
});

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/rounds — List all rounds
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

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR", "JUDGE");

    const roundsList = await getEventRounds(event.id);
    return NextResponse.json({ data: roundsList });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds");
  }
}

/**
 * POST /api/events/[slug]/rounds — Create a round
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
    const validated = createRoundSchema.parse(body);
    const result = await createRound(event.id, validated);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/rounds");
  }
}
