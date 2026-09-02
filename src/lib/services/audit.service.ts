import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Audit Logging Service (Level 31)
// ============================================

interface AuditLogInput {
  eventId?: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Write an audit log entry. Non-blocking — errors are silently swallowed
 * so audit logging never crashes the main request.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      eventId: input.eventId || null,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      details: input.details || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    });
  } catch (err) {
    // Audit log failures must never crash the application
    console.error("[AuditLog] Failed to write:", err);
  }
}

/**
 * Get audit logs for an event, newest first, with optional limit.
 */
export async function getEventAuditLogs(
  eventId: string,
  limit = 100
) {
  return db.query.auditLogs.findMany({
    where: eq(auditLogs.eventId, eventId),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
  });
}

/**
 * Helper to extract IP and User-Agent from a Request object.
 */
export function extractRequestMeta(request: Request) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent") || null,
  };
}

// ============================================
// Audit Action Constants
// ============================================

export const AuditAction = {
  // Auth
  USER_LOGIN: "USER_LOGIN",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",

  // Events
  EVENT_CREATED: "EVENT_CREATED",
  EVENT_UPDATED: "EVENT_UPDATED",
  EVENT_STATUS_CHANGED: "EVENT_STATUS_CHANGED",

  // Rounds
  ROUND_CREATED: "ROUND_CREATED",
  ROUND_STATUS_CHANGED: "ROUND_STATUS_CHANGED",
  ROUND_DELETED: "ROUND_DELETED",

  // Teams & Registration
  TEAM_REGISTERED: "TEAM_REGISTERED",
  DESK_ALLOTTED: "DESK_ALLOTTED",
  DESK_RELEASED: "DESK_RELEASED",

  // Attendance
  CHECKED_IN: "CHECKED_IN",
  CHECK_IN_UNDONE: "CHECK_IN_UNDONE",

  // Submissions
  SUBMISSION_CREATED: "SUBMISSION_CREATED",
  SUBMISSION_UPDATED: "SUBMISSION_UPDATED",

  // Judging
  JUDGMENT_SUBMITTED: "JUDGMENT_SUBMITTED",
  JUDGMENT_UNDONE: "JUDGMENT_UNDONE",
  SCORE_CORRECTED: "SCORE_CORRECTED",

  // Shortlisting
  SHORTLIST_COMPUTED: "SHORTLIST_COMPUTED",
  RESULTS_PUBLISHED: "RESULTS_PUBLISHED",

  // Certificates
  CERTIFICATE_GENERATED: "CERTIFICATE_GENERATED",
  CERTIFICATE_DOWNLOADED: "CERTIFICATE_DOWNLOADED",

  // Announcements
  ANNOUNCEMENT_CREATED: "ANNOUNCEMENT_CREATED",
  ANNOUNCEMENT_DELETED: "ANNOUNCEMENT_DELETED",
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];
