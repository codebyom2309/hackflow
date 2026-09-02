import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  getRoundCriteria,
  addCriterion,
  bulkSetCriteria,
} from "@/lib/services/criteria.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const criterionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  maxPoints: z.number().int().min(1).max(100),
  weight: z.number().min(0).max(10).optional(),
  displayOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
});

const bulkSchema = z.object({
  criteria: z.array(criterionSchema),
});

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId]/criteria — List criteria
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

    await requireRole(session.user.id, event.id, "ORGANIZER", "JUDGE");

    const criteria = await getRoundCriteria(roundId);
    return NextResponse.json({ data: criteria });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]/criteria");
  }
}

/**
 * POST /api/events/[slug]/rounds/[roundId]/criteria — Add single or bulk set
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

    // Bulk mode
    if (body.criteria && Array.isArray(body.criteria)) {
      const validated = bulkSchema.parse(body);
      await bulkSetCriteria(roundId, validated.criteria);
      return NextResponse.json({ message: "Criteria saved", count: validated.criteria.length });
    }

    // Single add
    const validated = criterionSchema.parse(body);
    const result = await addCriterion(roundId, validated);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/rounds/[roundId]/criteria");
  }
}
