import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { certificates, teams, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ code: string }> };

/**
 * GET /api/verify/[code]
 * Public certificate verification endpoint.
 * No authentication required.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;

    if (!code || code.length < 10) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.verificationCode, code),
    });

    if (!cert) {
      return NextResponse.json({
        verified: false,
        error: "Certificate not found. This code is invalid.",
      }, { status: 404 });
    }

    // Get team and event details
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, cert.teamId),
    });

    const event = await db.query.events.findFirst({
      where: eq(events.id, cert.eventId),
    });

    return NextResponse.json({
      verified: true,
      data: {
        recipientName: cert.recipientName,
        teamName: team?.name || "Unknown Team",
        eventName: event?.title || "Unknown Event",
        certificateType: cert.type,
        issuedAt: cert.generatedAt || cert.createdAt,
        verificationCode: cert.verificationCode,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
