import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { registerTeam, getRegistration } from "@/lib/services/registration.service";
import { registrationSchema } from "@/lib/validators/registration.validators";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/events/[slug]/register — Register a team
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

    const body = await request.json();
    const validated = registrationSchema.parse(body);

    const result = await registerTeam(
      event.id,
      session.user.id,
      validated,
      event.qrSecret
    );

    return NextResponse.json(
      { data: result, message: "Registration successful" },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/register");
  }
}

/**
 * GET /api/events/[slug]/register — Check registration status
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

    const registration = await getRegistration(session.user.id, event.id);

    if (!registration) {
      return NextResponse.json({ data: null, registered: false });
    }

    return NextResponse.json({ data: registration, registered: true });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/register");
  }
}
