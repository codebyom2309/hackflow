import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { db } from "@/lib/db";
import { teams, teamMembers, desks, rooms, attendanceRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/teams
 * List all teams with members and desk info.
 * Query params: ?search=... &status=... &page=1&limit=50
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER", "COORDINATOR");

    const search = req.nextUrl.searchParams.get("search") || "";
    const statusFilter = req.nextUrl.searchParams.get("status") || "";
    const seatingFilter = req.nextUrl.searchParams.get("seating") || "";
    const sortBy = req.nextUrl.searchParams.get("sortBy") || "recent";

    const { desc } = await import("drizzle-orm");
    let allTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, event.id),
      orderBy: [desc(teams.createdAt)],
    });

    // Apply search filter
    if (search) {
      const s = search.toLowerCase();
      allTeams = allTeams.filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          (t.leaderEmail && t.leaderEmail.toLowerCase().includes(s)) ||
          (t.leaderPhone && t.leaderPhone.toLowerCase().includes(s)) ||
          (t.college && t.college.toLowerCase().includes(s)) ||
          (t.theme && t.theme.toLowerCase().includes(s))
      );
    }

    // Apply status filter
    if (statusFilter) {
      allTeams = allTeams.filter((t) => t.status === statusFilter);
    }

    // Apply seating filter
    if (seatingFilter === "unseated") {
      allTeams = allTeams.filter((t) => !t.deskId);
    } else if (seatingFilter === "seated") {
      allTeams = allTeams.filter((t) => !!t.deskId);
    }

    // Apply sorting
    allTeams.sort((a, b) => {
      if (sortBy === "oldest") {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "unseated") {
        if (!a.deskId && b.deskId) return -1;
        if (a.deskId && !b.deskId) return 1;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === "members") {
        return (b.memberCount || 0) - (a.memberCount || 0);
      }
      // Default: recent first
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // Enrich with members and desk info
    const enriched = await Promise.all(
      allTeams.map(async (team) => {
        const members = await db.query.teamMembers.findMany({
          where: eq(teamMembers.teamId, team.id),
        });

        let desk = null;
        if (team.deskId) {
          const d = await db.query.desks.findFirst({
            where: eq(desks.id, team.deskId),
          });
          if (d) {
            const r = await db.query.rooms.findFirst({
              where: eq(rooms.id, d.roomId),
            });
            desk = {
              deskNumber: d.deskNumber,
              roomName: r?.name || "",
              roomNumber: r?.roomNumber || 0,
            };
          }
        }

        // Check-in status
        const checkIn = await db.query.attendanceRecords.findFirst({
          where: and(
            eq(attendanceRecords.teamId, team.id),
            eq(attendanceRecords.eventId, event.id),
            eq(attendanceRecords.isActive, true)
          ),
        });

        return {
          ...team,
          members,
          desk,
          isCheckedIn: !!checkIn,
          checkedInAt: checkIn?.checkedInAt || null,
        };
      })
    );

    // Stats
    const statusCounts: Record<string, number> = {};
    let unseatedCount = 0;
    let seatedCount = 0;
    for (const t of allTeams) {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      if (t.deskId) {
        seatedCount++;
      } else {
        unseatedCount++;
      }
    }

    return NextResponse.json({
      data: {
        teams: enriched,
        stats: {
          total: allTeams.length,
          statusCounts,
          unseatedCount,
          seatedCount,
          totalParticipants: enriched.reduce((sum, t) => sum + (t.members?.length || t.memberCount || 0), 0),
        },
      },
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

/**
 * PATCH /api/events/[slug]/teams
 * Bulk update teams (e.g., verify, change status).
 * Body: { teamIds: string[], updates: { status?, college?, theme? } }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const body = await req.json();
    const { teamIds, updates } = body;

    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return NextResponse.json({ error: "teamIds required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.college !== undefined) updateData.college = updates.college;
    if (updates.theme !== undefined) updateData.theme = updates.theme;
    if (updates.problemStatement !== undefined) updateData.problemStatement = updates.problemStatement;
    if (updates.projectName !== undefined) updateData.projectName = updates.projectName;
    if (updates.projectDescription !== undefined) updateData.projectDescription = updates.projectDescription;

    let updated = 0;
    const { reassignTeam, releaseDesk } = await import("@/lib/services/desk.service");

    for (const id of teamIds) {
      if (updates.deskId !== undefined) {
        try {
          if (!updates.deskId) {
            await releaseDesk(id);
          } else {
            await reassignTeam(id, updates.deskId);
          }
        } catch {
          // ignore if already assigned or cannot allocate
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(teams).set(updateData).where(
          and(eq(teams.id, id), eq(teams.eventId, event.id))
        );
      }
      updated++;
    }

    return NextResponse.json({ data: { updated } });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
