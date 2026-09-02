import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  createInvitation,
  getEventInvitations,
} from "@/lib/services/invitation.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const createInvitationSchema = z.object({
  role: z.enum(["COORDINATOR", "JUDGE"]),
  maxUses: z.number().int().min(1).optional().nullable(),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/invitations — List staff invitations (ORGANIZER only)
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const invitations = await getEventInvitations(event.id);
    return NextResponse.json({ data: invitations });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/invitations");
  }
}

/**
 * POST /api/events/[slug]/invitations — Generate staff invitation link (ORGANIZER only)
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();
    const validated = createInvitationSchema.parse(body);

    const invitation = await createInvitation(event.id, session.user.id, {
      role: validated.role,
      maxUses: validated.maxUses ?? undefined,
      expiresInHours: validated.expiresInHours,
    });

    return NextResponse.json({ data: invitation }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/invitations");
  }
}
