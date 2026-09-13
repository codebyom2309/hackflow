import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { db } from "@/lib/db";
import { eventMemberships, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/staff/heartbeat — Get list of event staff and their live presence
 */
export async function GET(req: NextRequest, { params }: Params) {
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

    // Fetch all staff members (ORGANIZER, COORDINATOR, JUDGE)
    const staffMemberships = await db.query.eventMemberships.findMany({
      where: and(
        eq(eventMemberships.eventId, event.id),
        sql`${eventMemberships.role} IN ('ORGANIZER', 'COORDINATOR', 'JUDGE')`
      ),
    });

    const now = Date.now();
    const staffList = await Promise.all(
      staffMemberships.map(async (m) => {
        const u = await db.query.users.findFirst({
          where: eq(users.id, m.userId),
        });

        const lastActiveTime = m.lastActiveAt ? new Date(m.lastActiveAt).getTime() : 0;
        // Online if pinged within last 5 minutes (300,000 ms)
        const isOnline = now - lastActiveTime < 300000;

        return {
          id: m.id,
          userId: m.userId,
          name: u?.name || "Staff Member",
          email: u?.email || "",
          role: m.role,
          isOnline,
          lastActiveAt: m.lastActiveAt,
          actionsCount: m.actionsCount || 0,
        };
      })
    );

    return NextResponse.json({
      data: {
        staff: staffList,
        onlineCount: staffList.filter((s) => s.isOnline).length,
        totalCount: staffList.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch staff presence" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[slug]/staff/heartbeat — Send presence heartbeat from staff device
 */
export async function POST(req: NextRequest, { params }: Params) {
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

    const body = await req.json().catch(() => ({}));
    const incrementAction = Boolean(body.actionRecorded);

    // Update lastActiveAt for this user's membership
    await db
      .update(eventMemberships)
      .set({
        lastActiveAt: new Date(),
        ...(incrementAction
          ? { actionsCount: sql`${eventMemberships.actionsCount} + 1` }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(eventMemberships.userId, session.user.id),
          eq(eventMemberships.eventId, event.id)
        )
      );

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Heartbeat failed" },
      { status: 500 }
    );
  }
}
