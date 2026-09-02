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
 * Get all events for a user (by their memberships).
 */
export async function getUserEvents(userId: string) {
  const memberships = await db.query.eventMemberships.findMany({
    where: eq(eventMemberships.userId, userId),
  });

  if (memberships.length === 0) return [];

  const eventIds = memberships.map((m) => m.eventId);
  const allEvents = [];

  for (const eventId of eventIds) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (event) {
      const membership = memberships.find((m) => m.eventId === eventId);
      allEvents.push({
        ...event,
        userRole: membership?.role,
      });
    }
  }

  return allEvents;
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
