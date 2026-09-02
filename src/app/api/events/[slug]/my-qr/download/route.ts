import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { getRegistration } from "@/lib/services/registration.service";
import { generateQRPayload, generateQRCodeBuffer } from "@/lib/services/qr.service";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/my-qr/download — Download participant's team QR code as PNG
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
    const pngBuffer = await generateQRCodeBuffer(payload);

    const safeName = reg.team.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr-${safeName}.png"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[GET /api/events/[slug]/my-qr/download]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
