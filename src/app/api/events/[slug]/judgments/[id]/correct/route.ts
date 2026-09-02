import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { correctScore } from "@/lib/services/judgment.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const correctSchema = z.object({
  correctedScore: z.number().int().min(0),
  reason: z.string().min(1, "Reason is required for corrections"),
});

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * POST /api/events/[slug]/judgments/[id]/correct — Correct a judgment score (ORGANIZER)
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, id } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();
    const validated = correctSchema.parse(body);

    const result = await correctScore(
      id,
      validated.correctedScore,
      session.user.id,
      validated.reason
    );
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/judgments/[id]/correct");
  }
}
