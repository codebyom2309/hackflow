import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { eventMemberships, events } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { Role } from "@/lib/constants";

// ============================================
// Auth Guard Utilities
// ============================================

/**
 * Get the authenticated session. Throws if not authenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("AUTH_REQUIRED", "Authentication required", 401);
  }
  return session;
}

/**
 * Check if the user has a specific role for an event.
 * Returns the membership if found, throws FORBIDDEN otherwise.
 * If checking for ORGANIZER, also accepts if user is the direct event creator (events.organizerId).
 */
export async function requireRole(
  userId: string,
  eventId: string,
  ...roles: Role[]
) {
  // 1. Direct organizer ownership check if ORGANIZER is an allowed role
  if (roles.includes("ORGANIZER")) {
    const event = await db.query.events.findFirst({
      where: and(eq(events.id, eventId), eq(events.organizerId, userId)),
    });
    if (event) {
      return {
        id: `owner-${eventId}`,
        userId,
        eventId,
        role: "ORGANIZER" as Role,
        invitationId: null,
        lastActiveAt: new Date(),
        actionsCount: 0,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      };
    }
  }

  // 2. Check explicit event membership table
  const membership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId),
      inArray(eventMemberships.role, roles)
    ),
  });

  if (!membership) {
    throw new AuthError(
      "FORBIDDEN",
      `Access denied. Requires one of the following roles: ${roles.join(", ")}`,
      403
    );
  }

  return membership;
}

/**
 * Get the user's role for a specific event. Returns null if no membership.
 */
export async function getUserEventRole(
  userId: string,
  eventId: string
): Promise<Role | null> {
  // Check if user is the event organizer/owner
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.organizerId, userId)),
  });
  if (event) return "ORGANIZER";

  // Check event membership table
  const membership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId)
    ),
  });

  return (membership?.role as Role) ?? null;
}

/**
 * Check if user has any membership for the event.
 */
export async function requireEventAccess(userId: string, eventId: string) {
  const role = await getUserEventRole(userId, eventId);
  if (!role) {
    throw new AuthError("FORBIDDEN", "No access to this event", 403);
  }
  return { role };
}

// ============================================
// Auth Error class
// ============================================

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode ?? (code === "AUTH_REQUIRED" ? 401 : 403);
  }
}
