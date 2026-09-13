import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/services/event.service";
import { autoDetectColumns, validateImportData, importTeams } from "@/lib/services/import.service";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeAuditLog, AuditAction } from "@/lib/services/audit.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/form-webhook — Health check / verification ping
 */
export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: "active",
    event: event.title,
    slug: event.slug,
    webhookUrl: `/api/events/${event.slug}/form-webhook`,
    message: "HackFlow live Google Form webhook is ready to receive submissions.",
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/events/[slug]/form-webhook — Live Google Form submission receiver
 * Accepts submissions from Google Apps Script (e.namedValues or JSON)
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid payload. Expected JSON object with form response fields." },
        { status: 400 }
      );
    }

    // Normalize Google Apps Script e.namedValues (where values are string arrays)
    const flatRow: Record<string, string> = {};
    for (const [key, val] of Object.entries(body)) {
      if (Array.isArray(val)) {
        flatRow[key] = String(val[0] ?? "").trim();
      } else if (val !== null && val !== undefined) {
        flatRow[key] = String(val).trim();
      }
    }

    const headers = Object.keys(flatRow);
    if (headers.length === 0) {
      return NextResponse.json(
        { error: "Empty submission. No field headers found." },
        { status: 400 }
      );
    }

    // Auto-detect column mapping
    const { mapping } = autoDetectColumns(headers);

    // Fetch existing teams for duplicate detection
    const existingTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, event.id),
      columns: { name: true, leaderEmail: true },
    });
    const existingTeamNames = new Set(existingTeams.map((t) => t.name.toLowerCase()));
    const existingEmails = new Set(
      existingTeams.map((t) => t.leaderEmail?.toLowerCase()).filter(Boolean) as string[]
    );

    // Validate the row
    const summary = validateImportData(
      [flatRow],
      mapping as any,
      1,
      event.maxTeamSize || 10,
      existingTeamNames,
      existingEmails
    );

    if (summary.validRows === 0) {
      const errs = summary.results[0]?.errors || ["Validation failed"];
      return NextResponse.json(
        { error: "Invalid form submission", details: errs },
        { status: 422 }
      );
    }

    const validRow = summary.results[0].data!;

    // Import the team (starts in REGISTERED status with NO fake desk pre-allotment)
    const importRes = await importTeams(event.id, [validRow], event.qrSecret);

    if (importRes.failed > 0) {
      const err = importRes.results[0]?.error || "Failed to persist registration";
      return NextResponse.json({ error: err }, { status: 500 });
    }

    // Audit log
    await writeAuditLog({
      eventId: event.id,
      userId: event.organizerId,
      action: AuditAction.TEAM_REGISTERED,
      entityType: "google_form_webhook",
      entityId: validRow.teamName,
      details: {
        teamName: validRow.teamName,
        leaderEmail: validRow.leaderEmail,
        memberCount: validRow.memberCount,
        source: "google_form_live",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Team successfully registered in HackFlow from Google Form",
      data: {
        teamName: validRow.teamName,
        leaderEmail: validRow.leaderEmail,
        status: "REGISTERED",
        memberCount: validRow.memberCount,
      },
    });
  } catch (error) {
    return handleApiError(error, "POST /api/events/[slug]/form-webhook");
  }
}
