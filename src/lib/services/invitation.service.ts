import { db } from "@/lib/db";
import { roleInvitations, eventMemberships, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { Role } from "@/lib/constants";
import crypto from "crypto";

// ============================================
// Invitation Service
// ============================================

export interface CreateInvitationInput {
  role: "COORDINATOR" | "JUDGE";
  maxUses?: number;
  expiresInHours?: number;
}

/**
 * Generate a new role invitation link/token.
 */
export async function createInvitation(
  eventId: string,
  createdBy: string,
  input: CreateInvitationInput
) {
  const token = `inv_${crypto.randomBytes(24).toString("hex")}`;
  const id = crypto.randomUUID();

  const hours = input.expiresInHours || 72; // default 3 days
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  await db.insert(roleInvitations).values({
    id,
    eventId,
    role: input.role,
    token,
    createdBy,
    expiresAt,
    maxUses: input.maxUses ?? null,
    useCount: 0,
    isRevoked: false,
  });

  return {
    id,
    token,
    role: input.role,
    expiresAt,
    maxUses: input.maxUses ?? null,
  };
}

/**
 * List all invitations for an event.
 */
export async function getEventInvitations(eventId: string) {
  return db.query.roleInvitations.findMany({
    where: eq(roleInvitations.eventId, eventId),
  });
}

/**
 * Revoke an active invitation.
 */
export async function revokeInvitation(invitationId: string, eventId: string) {
  const inv = await db.query.roleInvitations.findFirst({
    where: and(
      eq(roleInvitations.id, invitationId),
      eq(roleInvitations.eventId, eventId)
    ),
  });

  if (!inv) {
    throw new Error("Invitation not found");
  }

  await db
    .update(roleInvitations)
    .set({ isRevoked: true })
    .where(eq(roleInvitations.id, invitationId));
}

/**
 * Validate and accept an invitation token.
 */
export async function acceptInvitation(token: string, userId: string) {
  const inv = await db.query.roleInvitations.findFirst({
    where: eq(roleInvitations.token, token),
  });

  if (!inv) {
    throw new Error("Invalid invitation token");
  }

  if (inv.isRevoked) {
    throw new Error("This invitation has been revoked by the organizer");
  }

  if (new Date() > new Date(inv.expiresAt)) {
    throw new Error("This invitation link has expired");
  }

  if (inv.maxUses !== null && inv.useCount >= inv.maxUses) {
    throw new Error("This invitation link has reached its maximum uses");
  }

  // Check if user already has membership
  const existing = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, userId),
      eq(eventMemberships.eventId, inv.eventId)
    ),
  });

  if (existing) {
    if (existing.role === inv.role) {
      // Idempotent: already has this role
      return {
        eventId: inv.eventId,
        role: inv.role,
        alreadyMember: true,
      };
    }
    // Update role if invited to higher role or different staff role
    await db
      .update(eventMemberships)
      .set({ role: inv.role })
      .where(eq(eventMemberships.id, existing.id));
  } else {
    // Create new membership
    await db.insert(eventMemberships).values({
      id: crypto.randomUUID(),
      userId,
      eventId: inv.eventId,
      role: inv.role,
    });
  }

  // Increment used count
  await db
    .update(roleInvitations)
    .set({ useCount: inv.useCount + 1 })
    .where(eq(roleInvitations.id, inv.id));

  // Get event slug
  const event = await db.query.events.findFirst({
    where: eq(events.id, inv.eventId),
  });

  return {
    eventId: inv.eventId,
    eventSlug: event?.slug,
    eventTitle: event?.title,
    role: inv.role,
    alreadyMember: false,
  };
}

/**
 * Get public preview details of an invitation (before sign in).
 */
export async function getInvitationPreview(token: string) {
  const inv = await db.query.roleInvitations.findFirst({
    where: eq(roleInvitations.token, token),
  });

  if (!inv) return null;

  const event = await db.query.events.findFirst({
    where: eq(events.id, inv.eventId),
  });

  const isExpired = new Date() > new Date(inv.expiresAt);
  const isExhausted = inv.maxUses !== null && inv.useCount >= inv.maxUses;

  return {
    token: inv.token,
    role: inv.role,
    eventTitle: event?.title || "Hackathon Event",
    eventSlug: event?.slug,
    isRevoked: inv.isRevoked,
    isExpired,
    isExhausted,
    valid: !inv.isRevoked && !isExpired && !isExhausted,
  };
}
