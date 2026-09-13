import { db } from "@/lib/db";
import { events, teams, teamMembers, eventMemberships, users, desks, rooms } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { allocateDesk } from "./desk.service";
import type { RegistrationInput } from "@/lib/validators/registration.validators";
import crypto from "crypto";

// ============================================
// Registration Service
// ============================================

/**
 * Register a team for an event. Handles:
 * 1. Validation checks (deadline, max teams, duplicates)
 * 2. User record creation (if needed)
 * 3. Team creation
 * 4. Team member records
 * 5. Desk allocation (or waitlisting)
 * 6. QR token generation
 * 7. Event membership for leader
 */
export async function registerTeam(
  eventId: string,
  userId: string,
  input: RegistrationInput,
  qrSecret: string
) {
  // 1. Get event and validate
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) throw new Error("Event not found");

  // Check registration is open
  if (
    event.status !== "REGISTRATION_OPEN" &&
    event.status !== "EVENT_READY"
  ) {
    throw new Error("Registration is not currently open for this event");
  }

  // Check deadline
  if (event.registrationCloses && new Date() > new Date(event.registrationCloses)) {
    throw new Error("Registration deadline has passed");
  }

  // Check team size
  if (input.teamSize < event.minTeamSize || input.teamSize > event.maxTeamSize) {
    throw new Error(
      `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}`
    );
  }

  // Check max teams limit
  if (event.maxTeams) {
    const existingTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId),
    });
    if (existingTeams.length >= event.maxTeams) {
      throw new Error("Maximum team limit reached for this event");
    }
  }

  // Check duplicate registration (same leader in same event)
  const existingMembership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "PARTICIPANT")
    ),
  });

  if (existingMembership) {
    throw new Error("You are already registered for this event");
  }

  // 2. Generate QR token
  const qrToken = generateQRToken(eventId, input.teamName, qrSecret);

  // 3. Create team
  const teamId = crypto.randomUUID();
  await db.insert(teams).values({
    id: teamId,
    eventId,
    name: input.teamName,
    leaderId: userId,
    leaderEmail: input.leaderEmail,
    leaderPhone: input.leaderPhone || input.members?.[0]?.phone || undefined,
    college: input.college || (input.customFields?.college as string) || undefined,
    theme: input.theme || (input.customFields?.theme as string) || undefined,
    memberCount: input.teamSize,
    qrToken,
    status: "REGISTERED",
    formResponses: input.customFields || null,
  });

  // 4. Create team members
  const memberRecords = [];

  // Leader is always a member
  memberRecords.push({
    id: crypto.randomUUID(),
    teamId,
    name: input.leaderName || input.members?.[0]?.name || "Team Leader",
    email: input.leaderEmail,
    phone: input.leaderPhone || input.members?.[0]?.phone || undefined,
    isLeader: true,
  });

  // Additional members
  if (input.members && input.members.length > 1) {
    for (let i = 1; i < input.members.length; i++) {
      const member = input.members[i];
      if (!member.name || !member.name.trim()) continue;
      memberRecords.push({
        id: crypto.randomUUID(),
        teamId,
        name: member.name.trim(),
        email: member.email?.trim() || `member${i}_${teamId.slice(0, 8)}@participant.hackflow`,
        phone: member.phone?.trim() || undefined,
        isLeader: false,
      });
    }
  }

  if (memberRecords.length > 0) {
    await db.insert(teamMembers).values(memberRecords);
  }

  // 5. Create event membership for leader
  await db.insert(eventMemberships).values({
    id: crypto.randomUUID(),
    userId,
    eventId,
    role: "PARTICIPANT",
  });

  // 6. Try to allocate desk
  let deskAssignment = null;
  try {
    deskAssignment = await allocateDesk(eventId, teamId, input.teamSize);
  } catch {
    // Desk allocation failure is non-fatal — team remains REGISTERED
    console.warn(`[Registration] Desk allocation failed for team ${teamId}`);
  }

  if (!deskAssignment) {
    // Mark as waitlisted
    await db
      .update(teams)
      .set({ status: "WAITLISTED" })
      .where(eq(teams.id, teamId));
  }

  return {
    teamId,
    teamName: input.teamName,
    qrToken,
    status: deskAssignment ? "ACTIVE" : "WAITLISTED",
    desk: deskAssignment,
    memberCount: input.teamSize,
  };
}

/**
 * Generate HMAC-signed QR token for a team.
 */
function generateQRToken(
  eventId: string,
  teamName: string,
  secret: string
): string {
  const payload = `${eventId}:${teamName}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `hf_${hmac.substring(0, 24)}`;
}

/**
 * Get registration details for a user in an event.
 * Checks both leaderId and leaderEmail for imported team support.
 */
export async function getRegistration(userId: string, eventId: string) {
  // First check if there's a PARTICIPANT membership
  const membership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "PARTICIPANT")
    ),
  });

  // Find the team — check by leaderId first
  let team = await db.query.teams.findFirst({
    where: and(eq(teams.eventId, eventId), eq(teams.leaderId, userId)),
  });

  // If not found by leaderId, check by leaderEmail (imported teams)
  if (!team) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (user?.email) {
      const normalizedEmail = user.email.trim().toLowerCase();
      team = await db.query.teams.findFirst({
        where: and(
          eq(teams.eventId, eventId),
          eq(teams.leaderEmail, normalizedEmail)
        ),
      });

      // If found via email, claim leadership
      if (team) {
        const { claimTeamLeadership } = await import("./user-mapping.service");
        await claimTeamLeadership(userId, team.id, eventId);
        // Refresh team record
        team = await db.query.teams.findFirst({
          where: eq(teams.id, team.id),
        });
      }
    }
  }

  // Still not found? Check if user is a team member (non-leader)
  if (!team) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (user?.email) {
      const normalizedEmail = user.email.trim().toLowerCase();
      const allEventTeams = await db.query.teams.findMany({
        where: eq(teams.eventId, eventId),
      });
      for (const t of allEventTeams) {
        const member = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, t.id),
            eq(teamMembers.email, normalizedEmail)
          ),
        });
        if (member) {
          team = t;
          // Ensure membership exists
          const { claimTeamMembership } = await import("./user-mapping.service");
          await claimTeamMembership(userId, eventId);
          break;
        }
      }
    }
  }

  if (!team) return null;

  // Get team members
  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.teamId, team.id),
  });

  // Get desk and room info if assigned
  let desk = null;
  if (team.deskId) {
    const deskRecord = await db.query.desks.findFirst({
      where: eq(desks.id, team.deskId),
    });
    if (deskRecord) {
      const roomRecord = await db.query.rooms.findFirst({
        where: eq(rooms.id, deskRecord.roomId),
      });
      desk = {
        id: deskRecord.id,
        deskNumber: deskRecord.deskNumber,
        capacity: deskRecord.capacity,
        roomName: roomRecord?.name || "Main Hall",
        roomNumber: roomRecord?.roomNumber || 1,
      };
    }
  }

  return {
    team,
    members,
    membership,
    desk,
  };
}

