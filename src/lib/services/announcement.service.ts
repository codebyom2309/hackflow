import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Announcement Service (Level 29)
// ============================================

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type TargetRole = "ALL" | "PARTICIPANT" | "COORDINATOR" | "JUDGE";

interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority?: Priority;
  targetRole?: TargetRole;
}

/**
 * Create a new announcement.
 */
export async function createAnnouncement(
  eventId: string,
  createdBy: string,
  input: CreateAnnouncementInput
) {
  const id = crypto.randomUUID();

  await db.insert(announcements).values({
    id,
    eventId,
    title: input.title,
    content: input.content,
    priority: input.priority || "NORMAL",
    targetRole: input.targetRole || "ALL",
    createdBy,
  });

  return { id };
}

/**
 * List all announcements for an event, newest first.
 */
export async function getEventAnnouncements(eventId: string) {
  return db.query.announcements.findMany({
    where: eq(announcements.eventId, eventId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
}

/**
 * Delete an announcement.
 */
export async function deleteAnnouncement(id: string) {
  await db.delete(announcements).where(eq(announcements.id, id));
}
