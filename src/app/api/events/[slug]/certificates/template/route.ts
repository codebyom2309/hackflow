import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/api/response";
import type {
  CustomCertificateTemplate,
  ParticipantExperienceConfig,
} from "@/lib/types/participant-experience";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/certificates/template
 * Returns the configured certificate template for this event
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const expConfig = (event.participantExperienceConfig || {}) as ParticipantExperienceConfig;
    return NextResponse.json({
      data: expConfig.certificateTemplate || null,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/certificates/template");
  }
}

/**
 * POST /api/events/[slug]/certificates/template
 * Saves custom certificate template (background image + variable elements)
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Auth required", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json(
        { error: "Event not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const body = await request.json();
    const template = body.template as CustomCertificateTemplate;

    if (!template || !Array.isArray(template.elements)) {
      return NextResponse.json(
        { error: "Invalid template payload: elements array required" },
        { status: 400 }
      );
    }

    const currentConfig = (event.participantExperienceConfig || {}) as ParticipantExperienceConfig;
    const updatedConfig: ParticipantExperienceConfig = {
      ...currentConfig,
      certificateTemplate: template,
    };

    await db
      .update(events)
      .set({
        participantExperienceConfig: updatedConfig,
      })
      .where(eq(events.id, event.id));

    return NextResponse.json({
      success: true,
      data: template,
      message: "Certificate template saved successfully!",
    });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/certificates/template");
  }
}
