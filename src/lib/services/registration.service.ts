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
    name: input.members?.[0]?.name || "Team Leader",
    email: input.leaderEmail,
    phone: input.members?.[0]?.phone || undefined,
    isLeader: true,
  });

  // Additional members
  if (input.members && input.members.length > 1) {
    for (let i = 1; i < input.members.length; i++) {
      const member = input.members[i];
      memberRecords.push({
        id: crypto.randomUUID(),
        teamId,
        name: member.name,
        email: member.email || `member${i}@placeholder.local`,
        phone: member.phone || undefined,
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
 */
export async function getRegistration(userId: string, eventId: string) {
  const membership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId),
      eq(eventMemberships.role, "PARTICIPANT")
    ),
  });

  if (!membership) return null;

  // Find the team
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.eventId, eventId), eq(teams.leaderId, userId)),
  });

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
