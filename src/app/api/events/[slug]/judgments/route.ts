import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  submitJudgment,
  undoJudgment,
  getJudgeProgress,
} from "@/lib/services/judgment.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const submitSchema = z.object({
  teamId: z.string().uuid(),
  roundId: z.string().uuid(),
  scores: z.array(
    z.object({
      criteriaId: z.string().uuid(),
      score: z.number().int().min(0),
    })
  ),
  idempotencyKey: z.string().min(1),
});

const undoSchema = z.object({
  teamId: z.string().uuid(),
  roundId: z.string().uuid(),
});

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/events/[slug]/judgments — Submit judgment scores
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

    await requireRole(session.user.id, event.id, "JUDGE");

    const body = await request.json();
    const validated = submitSchema.parse(body);

    const result = await submitJudgment(event.id, session.user.id, validated);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/judgments");
  }
}

/**
 * DELETE /api/events/[slug]/judgments — Undo judgment (within 10s window)
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "JUDGE");

    const body = await request.json();
    const validated = undoSchema.parse(body);

    const result = await undoJudgment(
      event.id,
      session.user.id,
      validated.teamId,
      validated.roundId
    );
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "DELETE /api/events/[slug]/judgments");
  }
}
