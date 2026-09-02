import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { eventMemberships } from "@/lib/db/schema";
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
    throw new AuthError("AUTH_REQUIRED", "Authentication required");
  }
  return session;
}

/**
 * Check if the user has a specific role for an event.
 * Returns the membership if found, throws FORBIDDEN otherwise.
 */
export async function requireRole(
  userId: string,
  eventId: string,
  ...roles: Role[]
) {
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
      `Requires one of: ${roles.join(", ")}`
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
  const membership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, eventId)
    ),
  });

  if (!membership) {
    throw new AuthError("FORBIDDEN", "No access to this event");
  }

  return membership;
}

// ============================================
// Auth Error class
// ============================================

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(
    code: string,
    message: string,
    statusCode?: number
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode =
      statusCode ?? (code === "AUTH_REQUIRED" ? 401 : 403);
  }
}
