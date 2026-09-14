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

/**
 * Add a Judge or Coordinator by email and name.
 * If user doesn't exist in DB, creates a provisional user record so Google Sign-In connects automatically.
 */
export async function addEventStaffMember(
  eventId: string,
  email: string,
  name: string,
  role: "JUDGE" | "COORDINATOR"
) {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) throw new Error("Email is required");

  // 1. Find or create user
  let user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (!user) {
    const newUserId = crypto.randomUUID();
    await db.insert(users).values({
      id: newUserId,
      email: normalizedEmail,
      name: name.trim() || normalizedEmail.split("@")[0],
      provider: "google",
    });
    user = {
      id: newUserId,
      email: normalizedEmail,
      name: name.trim() || normalizedEmail.split("@")[0],
    } as any;
  }

  // 2. Check existing event membership
  const existing = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, user!.id),
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, role)
    ),
  });

  if (existing) {
    return { user: user!, membership: existing, alreadyExisted: true };
  }

  // 3. Create membership
  const membershipId = crypto.randomUUID();
  await db.insert(eventMemberships).values({
    id: membershipId,
    userId: user!.id,
    eventId,
    role,
    actionsCount: 0,
    lastActiveAt: new Date(),
  });

  return {
    user: user!,
    membership: { id: membershipId, userId: user!.id, eventId, role },
    alreadyExisted: false,
  };
}

/**
 * Remove a Judge or Coordinator from an event
 */
export async function removeEventStaffMember(
  eventId: string,
  userId: string,
  role: "JUDGE" | "COORDINATOR"
) {
  await db
    .delete(eventMemberships)
    .where(
      and(
        eq(eventMemberships.userId, userId),
        eq(eventMemberships.eventId, eventId),
        eq(eventMemberships.role, role)
      )
    );

  if (role === "JUDGE") {
    // Also remove team assignments
    await db
      .delete(judgeAssignments)
      .where(
        and(
          eq(judgeAssignments.judgeId, userId),
          eq(judgeAssignments.eventId, eventId)
        )
      );
  }

  return { success: true };
}

/**
 * Get all Judges for an event with their live evaluation progress
 */
export async function getEventJudgesWithProgress(
  eventId: string,
  roundId?: string
) {
  const { judgmentScores } = await import("@/lib/db/schema/judging");

  const judgeMemberships = await db.query.eventMemberships.findMany({
    where: and(
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "JUDGE")
    ),
  });

  const judgesList = [];

  for (const m of judgeMemberships) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, m.userId),
    });

    // Total assigned teams across round (or event)
    const assignmentWhere = roundId
      ? and(eq(judgeAssignments.judgeId, m.userId), eq(judgeAssignments.roundId, roundId))
      : eq(judgeAssignments.judgeId, m.userId);

    const assignments = await db.query.judgeAssignments.findMany({
      where: assignmentWhere,
    });

    const assignedTeamIds = assignments.map((a) => a.teamId);

    // Count distinct evaluated teams
    let evaluatedCount = 0;
    if (assignedTeamIds.length > 0) {
      const scores = await db.query.judgmentScores.findMany({
        where: roundId
          ? and(
              eq(judgmentScores.judgeId, m.userId),
              eq(judgmentScores.roundId, roundId),
              eq(judgmentScores.eventId, eventId)
            )
          : and(
              eq(judgmentScores.judgeId, m.userId),
              eq(judgmentScores.eventId, eventId)
            ),
      });

      const evaluatedTeamSet = new Set(scores.map((s) => s.teamId));
      evaluatedCount = evaluatedTeamSet.size;
    }

    judgesList.push({
      id: m.userId,
      membershipId: m.id,
      name: user?.name || "Judge",
      email: user?.email || "",
      image: user?.image || null,
      assignedTeamsCount: assignments.length,
      evaluatedTeamsCount: evaluatedCount,
      assignedTeamIds,
      status: evaluatedCount === assignments.length && assignments.length > 0 ? "COMPLETED" : assignments.length > 0 ? "IN_PROGRESS" : "PENDING",
      createdAt: m.createdAt,
    });
  }

  return judgesList;
}

/**
 * Get all Coordinators for an event
 */
export async function getEventCoordinators(eventId: string) {
  const coordinatorMemberships = await db.query.eventMemberships.findMany({
    where: and(
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "COORDINATOR")
    ),
  });

  const coordinators = [];

  for (const m of coordinatorMemberships) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, m.userId),
    });

    coordinators.push({
      id: m.userId,
      membershipId: m.id,
      name: user?.name || "Coordinator",
      email: user?.email || "",
      image: user?.image || null,
      actionsCount: m.actionsCount || 0,
      lastActiveAt: m.lastActiveAt || m.createdAt,
      createdAt: m.createdAt,
    });
  }

  return coordinators;
}
