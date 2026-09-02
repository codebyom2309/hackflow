import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { getRegistration } from "@/lib/services/registration.service";
import { generateQRPayload, generateQRCodeDataURL } from "@/lib/services/qr.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/my-qr — Get participant's team QR code info and Data URL
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

    const reg = await getRegistration(session.user.id, event.id);
    if (!reg?.team) {
      return NextResponse.json({ error: "No registered team found" }, { status: 404 });
    }

    const payload = generateQRPayload(event.id, reg.team.id, event.qrSecret);
    const dataUrl = await generateQRCodeDataURL(payload);

    return NextResponse.json({
      data: {
        teamId: reg.team.id,
        teamName: reg.team.name,
        qrToken: reg.team.qrToken,
        payload,
        dataUrl,
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/my-qr");
  }
}
