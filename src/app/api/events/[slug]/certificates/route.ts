import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  generateCertificates,
  getEventCertificates,
} from "@/lib/services/certificate.service";
import { writeAuditLog, AuditAction } from "@/lib/services/audit.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/certificates — List all certificates (ORGANIZER)
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

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const data = await getEventCertificates(event.id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/certificates");
  }
}

/**
 * POST /api/events/[slug]/certificates — Generate certificates for all teams
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

    const result = await generateCertificates(event.id);

    // Audit log
    await writeAuditLog({
      eventId: event.id,
      userId: session.user.id,
      action: AuditAction.CERTIFICATE_GENERATED,
      entityType: "event",
      entityId: event.id,
      details: result,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/certificates");
  }
}
