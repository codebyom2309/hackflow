import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  ParticipantExperienceConfig,
  DEFAULT_EXPERIENCE_CONFIG,
} from "@/lib/types/participant-experience";

export type { ParticipantExperienceConfig };
export { DEFAULT_EXPERIENCE_CONFIG };

/**
 * Get the participant experience configuration for an event
 */
export async function getParticipantExperience(eventId: string) {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) return null;

  const stored = (event.participantExperienceConfig as ParticipantExperienceConfig) || null;

  return {
    config: stored || { ...DEFAULT_EXPERIENCE_CONFIG, heroTitle: event.title, heroTagline: event.description || DEFAULT_EXPERIENCE_CONFIG.heroTagline },
    isPublished: stored?.isPublished ?? true,
    publishedAt: stored?.publishedAt ?? null,
  };
}

/**
 * Save or publish participant experience configuration (Organizer only)
 */
export async function saveParticipantExperience(
  eventId: string,
  config: ParticipantExperienceConfig,
  publish: boolean = false
) {
  const updatedConfig: ParticipantExperienceConfig = {
    ...config,
    isPublished: publish,
    publishedAt: publish ? new Date().toISOString() : config.publishedAt,
  };

  await db
    .update(events)
    .set({
      participantExperienceConfig: updatedConfig,
    })
    .where(eq(events.id, eventId));

  return updatedConfig;
}
