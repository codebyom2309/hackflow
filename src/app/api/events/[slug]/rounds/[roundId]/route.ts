import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getRoundById,
  updateRound,
  changeRoundStatus,
  deleteRound,
} from "@/lib/services/round.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const updateRoundSchema = z.object({
  title: z.string().max(255).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  problemRevealAt: z.string().nullable().optional(),
  submissionDeadline: z.string().nullable().optional(),
  shortlistCount: z.number().int().min(1).nullable().optional(),
  retainDesks: z.boolean().optional(),
  problemStatements: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  })).optional(),
});

const statusChangeSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SUBMISSION_OPEN",
    "SUBMISSION_LOCKED",
    "JUDGING",
    "RESULTS_PENDING",
    "RESULTS_PUBLISHED",
  ]),
});

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId] — Get round details
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

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR", "JUDGE");

    const round = await getRoundById(roundId);
    if (!round)
      return NextResponse.json({ error: "Round not found" }, { status: 404 });

    return NextResponse.json({ data: round });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]");
  }
}

/**
 * PATCH /api/events/[slug]/rounds/[roundId] — Update round config or status
 */
export async function PATCH(request: Request, { params }: Params) {
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

    // Check if this is a status change
    if (body.status) {
      const validated = statusChangeSchema.parse(body);
      const result = await changeRoundStatus(event.id, roundId, validated.status);
      return NextResponse.json({ data: result });
    }

    // Otherwise it's a config update
    const validated = updateRoundSchema.parse(body);
    await updateRound(roundId, validated);

    return NextResponse.json({ message: "Round updated" });
  } catch (error) {
    return handleApiError(error, "PATCH /api/events/[slug]/rounds/[roundId]");
  }
}

/**
 * DELETE /api/events/[slug]/rounds/[roundId] — Delete a draft round
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    await deleteRound(roundId);
    return NextResponse.json({ message: "Round deleted" });
  } catch (error) {
    return handleApiError(error, "DELETE /api/events/[slug]/rounds/[roundId]");
  }
}
