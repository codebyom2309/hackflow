import { db } from "@/lib/db";
import { events, eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { EVENT_TRANSITIONS } from "@/lib/constants";
import type { CreateEventInput, UpdateEventInput } from "@/lib/validators/event.validators";
import crypto from "crypto";

// ============================================
// Event Service — Business Logic
// ============================================

/**
 * Generate a URL-safe slug from a title.
 * Appends a random suffix to avoid collisions.
 */
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

/**
 * Create a new event. The creator automatically becomes an ORGANIZER.
 */
export async function createEvent(userId: string, input: CreateEventInput) {
  const slug = generateSlug(input.title);
  const qrSecret = crypto.randomBytes(32).toString("hex");

  const eventId = crypto.randomUUID();

  // Insert event
  await db.insert(events).values({
    id: eventId,
    organizerId: userId,
    title: input.title,
    slug,
    description: input.description ?? null,
    minTeamSize: input.minTeamSize,
    maxTeamSize: input.maxTeamSize,
    maxTeams: input.maxTeams ?? null,
    winnersCount: input.winnersCount,
    registrationMethod: input.registrationMethod,
    externalFormUrl: input.externalFormUrl ?? null,
    registrationOpens: input.registrationOpens
      ? new Date(input.registrationOpens)
      : null,
    registrationCloses: input.registrationCloses
      ? new Date(input.registrationCloses)
      : null,
    eventStarts: input.eventStarts ? new Date(input.eventStarts) : null,
    eventEnds: input.eventEnds ? new Date(input.eventEnds) : null,
    qrSecret,
    status: "DRAFT",
  });

  // Creator becomes ORGANIZER
  await db.insert(eventMemberships).values({
    id: crypto.randomUUID(),
    userId,
    eventId,
    role: "ORGANIZER",
  });

  return { id: eventId, slug };
}

/**
 * Participating item details
 */
export interface ParticipatingItem {
  event: typeof events.$inferSelect;
  team: {
    id: string;
    name: string;
    status: string;
    memberCount: number;
    college?: string | null;
    theme?: string | null;
    qrToken: string;
    desk?: { roomName: string; deskNumber: number } | null;
  };
  isLeader: boolean;
}

export interface UserEventsData {
  participating: ParticipatingItem[];
  organizing: Array<typeof events.$inferSelect>;
  staff: Array<{ event: typeof events.$inferSelect; role: "JUDGE" | "COORDINATOR" }>;
  publicEvents: Array<typeof events.$inferSelect>;
}

/**
 * Get unified categorized events data for a user:
 * - Participating events (as leader or member)
 * - Organizing events
 * - Staff events (Judge / Coordinator)
 * - Discoverable public events
 */
export async function getUserEventsHubData(userId: string): Promise<UserEventsData> {
  const { users, teams, teamMembers, desks, rooms } = await import("@/lib/db/schema");
  const { inArray, or, ne } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  const userEmail = user?.email?.toLowerCase().trim();

  // 1. Organizing Events
  const createdEvents = await db.query.events.findMany({
    where: eq(events.organizerId, userId),
  });

  const organizerMemberships = await db.query.eventMemberships.findMany({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.role, "ORGANIZER")
    ),
  });
  const membershipEventIds = organizerMemberships.map((m) => m.eventId);

  const additionalOrganized = membershipEventIds.length > 0
    ? await db.query.events.findMany({
        where: inArray(events.id, membershipEventIds),
      })
    : [];

  const organizingMap = new Map<string, typeof events.$inferSelect>();
  createdEvents.forEach((e) => organizingMap.set(e.id, e));
  additionalOrganized.forEach((e) => organizingMap.set(e.id, e));
  const organizing = Array.from(organizingMap.values());

  // 2. Staff Events (JUDGE / COORDINATOR)
  const staffMemberships = await db.query.eventMemberships.findMany({
    where: and(
      eq(eventMemberships.userId, userId),
      or(
        eq(eventMemberships.role, "JUDGE"),
        eq(eventMemberships.role, "COORDINATOR")
      )
    ),
  });

  const staff: Array<{ event: typeof events.$inferSelect; role: "JUDGE" | "COORDINATOR" }> = [];
  for (const sm of staffMemberships) {
    const ev = await db.query.events.findFirst({
      where: eq(events.id, sm.eventId),
    });
    if (ev) {
      staff.push({ event: ev, role: sm.role as "JUDGE" | "COORDINATOR" });
    }
  }

  // 3. Participating Teams (Leader or Member)
  const participatingList: ParticipatingItem[] = [];

  // A. Teams where user is leader by ID
  const leaderTeams = await db.query.teams.findMany({
    where: eq(teams.leaderId, userId),
  });

  // B. Teams where user is leader by Email
  const emailLeaderTeams = userEmail
    ? await db.query.teams.findMany({
        where: eq(teams.leaderEmail, userEmail),
      })
    : [];

  // C. Teams where user is member by Email
  const memberRows = userEmail
    ? await db.query.teamMembers.findMany({
        where: eq(teamMembers.email, userEmail),
      })
    : [];
  const memberTeamIds = memberRows.map((m) => m.teamId);
  const memberTeams = memberTeamIds.length > 0
    ? await db.query.teams.findMany({
        where: inArray(teams.id, memberTeamIds),
      })
    : [];

  const allFoundTeams = [...leaderTeams, ...emailLeaderTeams, ...memberTeams];
  const uniqueTeamsMap = new Map<string, typeof teams.$inferSelect>();
  allFoundTeams.forEach((t) => uniqueTeamsMap.set(t.id, t));

  for (const team of uniqueTeamsMap.values()) {
    const ev = await db.query.events.findFirst({
      where: eq(events.id, team.eventId),
    });
    if (!ev) continue;

    // Get desk details if allocated
    let deskInfo = null;
    if (team.deskId) {
      const desk = await db.query.desks.findFirst({
        where: eq(desks.id, team.deskId),
      });
      if (desk) {
        const room = await db.query.rooms.findFirst({
          where: eq(rooms.id, desk.roomId),
        });
        deskInfo = {
          deskNumber: desk.deskNumber,
          roomName: room?.name || `Room ${room?.roomNumber || ""}`,
        };
      }
    }

    const isLeader = team.leaderId === userId || (userEmail && team.leaderEmail?.toLowerCase() === userEmail);

    participatingList.push({
      event: ev,
      team: {
        id: team.id,
        name: team.name,
        status: team.status,
        memberCount: team.memberCount,
        college: team.college,
        theme: team.theme,
        qrToken: team.qrToken,
        desk: deskInfo,
      },
      isLeader: Boolean(isLeader),
    });
  }

  // 4. Public Hackathons (Discoverable)
  const publicEvents = await db.query.events.findMany({
    where: ne(events.status, "DRAFT"),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });

  return {
    participating: participatingList,
    organizing,
    staff,
    publicEvents,
  };
}

/**
 * Get all events for a user (combining organizing, staff, and participating).
 */
export async function getUserEvents(userId: string) {
  const hubData = await getUserEventsHubData(userId);
  const eventMap = new Map<string, typeof events.$inferSelect & { userRole?: string; userTeam?: unknown }>();

  // Add organizing
  hubData.organizing.forEach((e) => {
    eventMap.set(e.id, { ...e, userRole: "ORGANIZER" });
  });

  // Add staff
  hubData.staff.forEach(({ event, role }) => {
    if (!eventMap.has(event.id)) {
      eventMap.set(event.id, { ...event, userRole: role });
    }
  });

  // Add participating
  hubData.participating.forEach(({ event, team }) => {
    if (!eventMap.has(event.id)) {
      eventMap.set(event.id, { ...event, userRole: "PARTICIPANT", userTeam: team });
    }
  });

  return Array.from(eventMap.values());
}

/**
 * Get event by slug.
 */
export async function getEventBySlug(slug: string) {
  return db.query.events.findFirst({
    where: eq(events.slug, slug),
  });
}

/**
 * Update event settings.
 */
export async function updateEvent(eventId: string, input: UpdateEventInput) {
  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.minTeamSize !== undefined) updateData.minTeamSize = input.minTeamSize;
  if (input.maxTeamSize !== undefined) updateData.maxTeamSize = input.maxTeamSize;
  if (input.maxTeams !== undefined) updateData.maxTeams = input.maxTeams;
  if (input.winnersCount !== undefined) updateData.winnersCount = input.winnersCount;
  if (input.registrationMethod !== undefined)
    updateData.registrationMethod = input.registrationMethod;
  if (input.externalFormUrl !== undefined)
    updateData.externalFormUrl = input.externalFormUrl;
  if (input.registrationOpens !== undefined)
    updateData.registrationOpens = input.registrationOpens
      ? new Date(input.registrationOpens)
      : null;
  if (input.registrationCloses !== undefined)
    updateData.registrationCloses = input.registrationCloses
      ? new Date(input.registrationCloses)
      : null;
  if (input.eventStarts !== undefined)
    updateData.eventStarts = input.eventStarts
      ? new Date(input.eventStarts)
      : null;
  if (input.eventEnds !== undefined)
    updateData.eventEnds = input.eventEnds ? new Date(input.eventEnds) : null;
  if (input.googleSheetUrl !== undefined)
    updateData.googleSheetUrl = input.googleSheetUrl;
  if (input.autoSyncEnabled !== undefined)
    updateData.autoSyncEnabled = input.autoSyncEnabled;
  if (input.syncIntervalMinutes !== undefined)
    updateData.syncIntervalMinutes = input.syncIntervalMinutes;
  if (input.participantNotice !== undefined)
    updateData.participantNotice = input.participantNotice;

  if (Object.keys(updateData).length === 0) return;

  await db.update(events).set(updateData).where(eq(events.id, eventId));
}

/**
 * Change event status with state machine validation.
 */
export async function changeEventStatus(eventId: string, newStatus: string) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const allowedTransitions = EVENT_TRANSITIONS[event.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${event.status} → ${newStatus}. Allowed: ${allowedTransitions.join(", ") || "none"}`
    );
  }

  await db
    .update(events)
    .set({ status: newStatus as typeof event.status })
    .where(eq(events.id, eventId));

  return { previousStatus: event.status, newStatus };
}

/**
 * Get event statistics.
 */
export async function getEventStats(eventId: string) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) throw new Error("Event not found");

  // Count teams by status
  const allTeams = await db.query.teams.findMany({
    where: eq(events.id, eventId),
  });

  const stats = {
    totalTeams: allTeams.length,
    registeredTeams: allTeams.filter((t) => t.status === "REGISTERED").length,
    waitlistedTeams: allTeams.filter((t) => t.status === "WAITLISTED").length,
    checkedInTeams: allTeams.filter(
      (t) => t.status === "CHECKED_IN" || t.status === "ACTIVE"
    ).length,
    shortlistedTeams: allTeams.filter((t) => t.status === "SHORTLISTED").length,
    eliminatedTeams: allTeams.filter((t) => t.status === "ELIMINATED").length,
    winnerTeams: allTeams.filter((t) => t.status === "WINNER").length,
  };

  return stats;
}
