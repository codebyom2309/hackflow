import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { syncEventGoogleSheet } from "@/lib/services/form-sync.service";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/form-sync — Get current Google Sheet sync configuration
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const fullEvent = await db.query.events.findFirst({
      where: eq(events.id, event.id),
      columns: {
        googleSheetUrl: true,
        autoSyncEnabled: true,
        lastSyncedAt: true,
        syncIntervalMinutes: true,
        participantNotice: true,
      },
    });

    return NextResponse.json({
      data: {
        googleSheetUrl: fullEvent?.googleSheetUrl || "",
        autoSyncEnabled: fullEvent?.autoSyncEnabled || false,
        lastSyncedAt: fullEvent?.lastSyncedAt || null,
        syncIntervalMinutes: fullEvent?.syncIntervalMinutes || 5,
        participantNotice: fullEvent?.participantNotice || "",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch sync status" },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * POST /api/events/[slug]/form-sync — Save configuration & execute live sync
 * Body: { sheetUrl?: string, autoSyncEnabled?: boolean, triggerSync?: boolean, csvContent?: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const body = await req.json().catch(() => ({}));
    const sheetUrl = body.sheetUrl || body.googleSheetUrl;
    const autoSync = body.autoSyncEnabled !== undefined ? body.autoSyncEnabled : body.autoSync;
    const syncInterval = body.syncIntervalMinutes !== undefined ? body.syncIntervalMinutes : body.syncInterval;
    const { triggerSync = true, csvContent } = body;

    // Save persistent settings if provided
    const updatePayload: Record<string, unknown> = {};
    if (sheetUrl !== undefined && sheetUrl !== null) updatePayload.googleSheetUrl = String(sheetUrl).trim();
    if (autoSync !== undefined) updatePayload.autoSyncEnabled = Boolean(autoSync);
    if (syncInterval !== undefined) updatePayload.syncIntervalMinutes = Number(syncInterval);

    if (Object.keys(updatePayload).length > 0) {
      await db
        .update(events)
        .set(updatePayload)
        .where(eq(events.id, event.id));
    }

    // Execute sync if requested
    if (triggerSync) {
      const targetUrl = sheetUrl || undefined;
      const stats = await syncEventGoogleSheet(event.id, targetUrl, csvContent);
      return NextResponse.json({
        success: true,
        message: `Sync completed: ${stats.newTeams} new teams registered, ${stats.updatedTeams} existing teams updated.`,
        data: stats,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Sync settings saved successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: error.statusCode || 500 }
    );
  }
}
