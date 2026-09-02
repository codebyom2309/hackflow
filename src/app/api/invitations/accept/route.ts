import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { acceptInvitation } from "@/lib/services/invitation.service";
import { handleApiError } from "@/lib/api/response";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

/**
 * POST /api/invitations/accept — Accept staff invitation
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const body = await request.json();
    const validated = acceptSchema.parse(body);

    const result = await acceptInvitation(validated.token, session.user.id);

    return NextResponse.json({
      data: result,
      message: `Successfully joined as ${result.role}!`,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/invitations/accept");
  }
}
