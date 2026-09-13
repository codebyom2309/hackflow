import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { markCertificateDownloaded } from "@/lib/services/certificate.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * POST /api/events/[slug]/certificates/[id]/download
 * Record certificate download timestamp.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug, id } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await markCertificateDownloaded(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/certificates/[id]/download");
  }
}
