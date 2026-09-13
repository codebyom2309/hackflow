import { z } from "zod";

// ============================================
// Event Validation Schemas
// ============================================

export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title must be at most 255 characters")
    .trim(),
  description: z.string().max(5000).optional(),
  minTeamSize: z.number().int().min(1).max(20).default(1),
  maxTeamSize: z.number().int().min(1).max(20).default(5),
  maxTeams: z.number().int().min(1).nullable().optional(),
  winnersCount: z.number().int().min(1).max(100).default(3),
  registrationMethod: z.enum(["NATIVE", "EXTERNAL"]).default("NATIVE"),
  externalFormUrl: z.string().url().optional().nullable(),
  registrationOpens: z.string().datetime().optional().nullable(),
  registrationCloses: z.string().datetime().optional().nullable(),
  eventStarts: z.string().datetime().optional().nullable(),
  eventEnds: z.string().datetime().optional().nullable(),
  googleSheetUrl: z.string().optional().nullable(),
  autoSyncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().min(1).max(1440).optional(),
  participantNotice: z.string().max(5000).optional().nullable(),
});

export const updateEventSchema = createEventSchema.partial();

export const changeEventStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "REGISTRATION_OPEN",
    "REGISTRATION_CLOSED",
    "EVENT_READY",
    "ROUND_ACTIVE",
    "EVENT_COMPLETED",
  ]),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ChangeEventStatusInput = z.infer<typeof changeEventStatusSchema>;
