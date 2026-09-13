import { db } from "@/lib/db";
import { teams, teamMembers, eventMemberships, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// User ↔ Team Mapping Service
// Resolves Google-authenticated users to their
// teams, even when registration was imported
// ============================================

/**
 * Given a user's email and event, find their associated team.
 * Searches both:
 *   1. teams.leaderEmail (for imported teams)
 *   2. teamMembers.email (for any member)
 *   3. teams.leaderId via users.id (for natively registered teams)
 *
 * Returns the team + role (leader vs member) or null.
 */
export async function resolveUserTeam(
  email: string,
  eventId: string
): Promise<{
  team: typeof teams.$inferSelect;
  isLeader: boolean;
  memberId: string | null;
} | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check if user is already linked as leader via leaderId
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (user) {
    const teamByLeaderId = await db.query.teams.findFirst({
      where: and(
        eq(teams.eventId, eventId),
        eq(teams.leaderId, user.id)
      ),
    });

    if (teamByLeaderId) {
      return { team: teamByLeaderId, isLeader: true, memberId: null };
    }
  }

  // 2. Check teams.leaderEmail (for imported teams where leaderId is placeholder)
  const teamByLeaderEmail = await db.query.teams.findFirst({
    where: and(
      eq(teams.eventId, eventId),
      eq(teams.leaderEmail, normalizedEmail)
    ),
  });

  if (teamByLeaderEmail) {
    return { team: teamByLeaderEmail, isLeader: true, memberId: null };
  }

  // 3. Check teamMembers.email (for non-leader members)
  const allEventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });
  const eventTeamIds = allEventTeams.map((t) => t.id);

  if (eventTeamIds.length > 0) {
    // Find member record matching this email
    for (const teamId of eventTeamIds) {
      const member = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.email, normalizedEmail)
        ),
      });

      if (member) {
        const team = allEventTeams.find((t) => t.id === teamId);
        if (team) {
          return {
            team,
            isLeader: member.isLeader,
            memberId: member.id,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Claim team leadership for an authenticated user.
 * Updates teams.leaderId from placeholder to real user ID,
 * and creates an eventMemberships record.
 *
 * This is called when a user signs in and we find their
 * team via email matching on an imported team.
 */
export async function claimTeamLeadership(
  userId: string,
  teamId: string,
  eventId: string
): Promise<void> {
  const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!team) throw new Error("Team not found");

  // Claim if not already linked to this userId
  if (team.leaderId !== userId) {
    await db
      .update(teams)
      .set({ leaderId: userId })
      .where(eq(teams.id, teamId));
  }

  // Create event membership if it doesn't exist
  const existing = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "PARTICIPANT")
    ),
  });

  if (!existing) {
    await db.insert(eventMemberships).values({
      id: crypto.randomUUID(),
      userId,
      eventId,
      role: "PARTICIPANT",
    });
  }
}

/**
 * Ensure a non-leader member gets proper access.
 * Creates a PARTICIPANT membership so they can view the dashboard.
 */
export async function claimTeamMembership(
  userId: string,
  eventId: string
): Promise<void> {
  const existing = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "PARTICIPANT")
    ),
  });

  if (!existing) {
    await db.insert(eventMemberships).values({
      id: crypto.randomUUID(),
      userId,
      eventId,
      role: "PARTICIPANT",
    });
  }
}
