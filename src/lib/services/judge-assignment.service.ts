import { db } from "@/lib/db";
import { judgeAssignments, teams, eventMemberships, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Judge Assignment Service
// ============================================

/**
 * Assign specific teams to a judge for a round.
 */
export async function assignTeamsToJudge(
  eventId: string,
  judgeId: string,
  roundId: string,
  teamIds: string[]
): Promise<{ assigned: number; skipped: number }> {
  let assigned = 0;
  let skipped = 0;

  for (const teamId of teamIds) {
    try {
      // Check if already assigned
      const existing = await db.query.judgeAssignments.findFirst({
        where: and(
          eq(judgeAssignments.judgeId, judgeId),
          eq(judgeAssignments.teamId, teamId),
          eq(judgeAssignments.roundId, roundId)
        ),
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(judgeAssignments).values({
        id: crypto.randomUUID(),
        judgeId,
        teamId,
        roundId,
        eventId,
      });
      assigned++;
    } catch {
      skipped++;
    }
  }

  return { assigned, skipped };
}

/**
 * Remove team assignments from a judge for a round.
 */
export async function removeAssignments(
  judgeId: string,
  roundId: string,
  teamIds: string[]
): Promise<{ removed: number }> {
  let removed = 0;
  for (const teamId of teamIds) {
    const existing = await db.query.judgeAssignments.findFirst({
      where: and(
        eq(judgeAssignments.judgeId, judgeId),
        eq(judgeAssignments.teamId, teamId),
        eq(judgeAssignments.roundId, roundId)
      ),
    });
    if (existing) {
      await db.delete(judgeAssignments).where(eq(judgeAssignments.id, existing.id));
      removed++;
    }
  }
  return { removed };
}

/**
 * Get all assignments for a judge in a round.
 * Returns the team details for each assigned team.
 */
export async function getJudgeAssignments(
  judgeId: string,
  roundId: string
): Promise<{ teamId: string; teamName: string; status: string }[]> {
  const assignments = await db.query.judgeAssignments.findMany({
    where: and(
      eq(judgeAssignments.judgeId, judgeId),
      eq(judgeAssignments.roundId, roundId)
    ),
  });

  const result = [];
  for (const a of assignments) {
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, a.teamId),
    });
    if (team) {
      result.push({
        teamId: team.id,
        teamName: team.name,
        status: team.status,
      });
    }
  }

  return result;
}

/**
 * Auto-distribute teams evenly among judges for a round.
 */
export async function autoDistributeTeams(
  eventId: string,
  roundId: string
): Promise<{ totalAssigned: number; judgeCount: number }> {
  // Get all judges
  const judgeMemberships = await db.query.eventMemberships.findMany({
    where: and(
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "JUDGE")
    ),
  });

  if (judgeMemberships.length === 0) {
    throw new Error("No judges assigned to this event");
  }

  // Get all active teams (non-eliminated)
  const allTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });
  const activeTeams = allTeams.filter(
    (t) => !["ELIMINATED"].includes(t.status)
  );

  if (activeTeams.length === 0) {
    throw new Error("No active teams to assign");
  }

  // Clear existing assignments for this round
  const existing = await db.query.judgeAssignments.findMany({
    where: and(
      eq(judgeAssignments.eventId, eventId),
      eq(judgeAssignments.roundId, roundId)
    ),
  });
  for (const a of existing) {
    await db.delete(judgeAssignments).where(eq(judgeAssignments.id, a.id));
  }

  // Round-robin distribution
  let totalAssigned = 0;
  for (let i = 0; i < activeTeams.length; i++) {
    const judgeIdx = i % judgeMemberships.length;
    const judgeId = judgeMemberships[judgeIdx].userId;

    await db.insert(judgeAssignments).values({
      id: crypto.randomUUID(),
      judgeId,
      teamId: activeTeams[i].id,
      roundId,
      eventId,
    });
    totalAssigned++;
  }

  return { totalAssigned, judgeCount: judgeMemberships.length };
}

/**
 * Get assignment matrix for a round (organizer view).
 * Returns each judge with their assigned team count.
 */
export async function getAssignmentMatrix(
  eventId: string,
  roundId: string
): Promise<Array<{
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  assignedTeams: number;
  teamIds: string[];
}>> {
  const judgeMemberships = await db.query.eventMemberships.findMany({
    where: and(
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "JUDGE")
    ),
  });

  const result = [];
  for (const m of judgeMemberships) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, m.userId),
    });

    const assignments = await db.query.judgeAssignments.findMany({
      where: and(
        eq(judgeAssignments.judgeId, m.userId),
        eq(judgeAssignments.roundId, roundId)
      ),
    });

    result.push({
      judgeId: m.userId,
      judgeName: user?.name || "Unknown",
      judgeEmail: user?.email || "",
      assignedTeams: assignments.length,
      teamIds: assignments.map((a) => a.teamId),
    });
  }

  return result;
}
