import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { db } from "@/lib/db";
import { teams, teamMembers, attendanceRecords, judgmentScores, rounds, shortlists, certificates, eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/stats
 * Get real-time event statistics from the database.
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

    // Teams by status
    const allTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, event.id),
    });

    const statusCounts: Record<string, number> = {};
    for (const t of allTeams) {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    }

    // Total participants
    const teamIds = allTeams.map((t) => t.id);
    let totalParticipants = 0;
    for (const id of teamIds) {
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, id),
      });
      totalParticipants += members.length;
    }

    // Check-in stats
    const activeCheckIns = await db.query.attendanceRecords.findMany({
      where: and(
        eq(attendanceRecords.eventId, event.id),
        eq(attendanceRecords.isActive, true)
      ),
    });

    // Rounds info
    const allRounds = await db.query.rounds.findMany({
      where: eq(rounds.eventId, event.id),
    });
    const activeRound = allRounds.find(
      (r) => r.status === "SUBMISSION_OPEN" || r.status === "JUDGING"
    );

    // Judging progress
    let judgingTeams = 0;
    let totalScores = 0;
    if (activeRound) {
      const scores = await db.query.judgmentScores.findMany({
        where: and(
          eq(judgmentScores.eventId, event.id),
          eq(judgmentScores.roundId, activeRound.id)
        ),
      });
      const scoredTeamIds = new Set(scores.map((s) => s.teamId));
      judgingTeams = scoredTeamIds.size;
      totalScores = scores.length;
    }

    // Shortlisted teams
    const allShortlists = await db.query.shortlists.findMany({
      where: eq(shortlists.eventId, event.id),
    });
    const advancingTeams = allShortlists.filter((s) => s.isAdvancing).length;

    // Certificates
    const allCerts = await db.query.certificates.findMany({
      where: eq(certificates.eventId, event.id),
    });

    // Staff counts
    const memberships = await db.query.eventMemberships.findMany({
      where: eq(eventMemberships.eventId, event.id),
    });
    const judges = memberships.filter((m) => m.role === "JUDGE").length;
    const coordinators = memberships.filter((m) => m.role === "COORDINATOR").length;

    return NextResponse.json({
      data: {
        totalTeams: allTeams.length,
        totalParticipants,
        statusCounts,
        checkedIn: activeCheckIns.length,
        checkInRate: allTeams.length > 0 ? Math.round((activeCheckIns.length / allTeams.length) * 100) : 0,
        activeRound: activeRound ? {
          id: activeRound.id,
          roundNumber: activeRound.roundNumber,
          title: activeRound.title,
          status: activeRound.status,
        } : null,
        judgingTeams,
        totalScores,
        shortlisted: advancingTeams,
        certificatesGenerated: allCerts.length,
        judges,
        coordinators,
        rounds: allRounds.length,
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
