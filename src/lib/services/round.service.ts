import { db } from "@/lib/db";
import { rounds, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Round Management Service
// ============================================

// Valid round status transitions
const ROUND_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMISSION_OPEN"],
  SUBMISSION_OPEN: ["SUBMISSION_LOCKED"],
  SUBMISSION_LOCKED: ["JUDGING"],
  JUDGING: ["RESULTS_PENDING"],
  RESULTS_PENDING: ["RESULTS_PUBLISHED"],
  RESULTS_PUBLISHED: [],
};

export type RoundStatus = keyof typeof ROUND_TRANSITIONS;

interface CreateRoundInput {
  roundNumber: number;
  title?: string;
  startsAt?: Date | string;
  endsAt?: Date | string;
  problemRevealAt?: Date | string;
  submissionDeadline?: Date | string;
  shortlistCount?: number;
  retainDesks?: boolean;
}

interface UpdateRoundInput {
  title?: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  problemRevealAt?: Date | string | null;
  submissionDeadline?: Date | string | null;
  shortlistCount?: number | null;
  retainDesks?: boolean;
  problemStatements?: unknown;
}

/**
 * Create a new round for an event.
 */
export async function createRound(eventId: string, input: CreateRoundInput) {
  const id = crypto.randomUUID();

  await db.insert(rounds).values({
    id,
    eventId,
    roundNumber: input.roundNumber,
    title: input.title || `Round ${input.roundNumber}`,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    problemRevealAt: input.problemRevealAt ? new Date(input.problemRevealAt) : null,
    submissionDeadline: input.submissionDeadline ? new Date(input.submissionDeadline) : null,
    shortlistCount: input.shortlistCount ?? null,
    retainDesks: input.retainDesks ?? true,
    status: "DRAFT",
  });

  return { id };
}

/**
 * List all rounds for an event, ordered by round number.
 */
export async function getEventRounds(eventId: string) {
  return db.query.rounds.findMany({
    where: eq(rounds.eventId, eventId),
    orderBy: (r, { asc }) => [asc(r.roundNumber)],
  });
}

/**
 * Get a single round by ID.
 */
export async function getRoundById(roundId: string) {
  return db.query.rounds.findFirst({
    where: eq(rounds.id, roundId),
  });
}

/**
 * Update round configuration (only allowed while DRAFT).
 */
export async function updateRound(roundId: string, input: UpdateRoundInput) {
  const round = await getRoundById(roundId);
  if (!round) throw new Error("Round not found");

  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.startsAt !== undefined) updateData.startsAt = input.startsAt ? new Date(input.startsAt as string) : null;
  if (input.endsAt !== undefined) updateData.endsAt = input.endsAt ? new Date(input.endsAt as string) : null;
  if (input.problemRevealAt !== undefined) updateData.problemRevealAt = input.problemRevealAt ? new Date(input.problemRevealAt as string) : null;
  if (input.submissionDeadline !== undefined) updateData.submissionDeadline = input.submissionDeadline ? new Date(input.submissionDeadline as string) : null;
  if (input.shortlistCount !== undefined) updateData.shortlistCount = input.shortlistCount;
  if (input.retainDesks !== undefined) updateData.retainDesks = input.retainDesks;
  if (input.problemStatements !== undefined) updateData.problemStatements = input.problemStatements;

  if (Object.keys(updateData).length > 0) {
    await db.update(rounds).set(updateData).where(eq(rounds.id, roundId));
  }
}

/**
 * Transition round status following the state machine.
 */
export async function changeRoundStatus(
  eventId: string,
  roundId: string,
  newStatus: string
) {
  const round = await db.query.rounds.findFirst({
    where: and(eq(rounds.id, roundId), eq(rounds.eventId, eventId)),
  });

  if (!round) throw new Error("Round not found");

  const allowed = ROUND_TRANSITIONS[round.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${round.status} → ${newStatus}. Allowed: ${(allowed || []).join(", ") || "none"}`
    );
  }

  // Validate: can't open submission if a previous round hasn't published results
  if (newStatus === "SUBMISSION_OPEN" && round.roundNumber > 1) {
    const prevRound = await db.query.rounds.findFirst({
      where: and(
        eq(rounds.eventId, eventId),
        eq(rounds.roundNumber, round.roundNumber - 1)
      ),
    });
    if (prevRound && prevRound.status !== "RESULTS_PUBLISHED") {
      throw new Error(
        `Cannot open Round ${round.roundNumber} submissions: Round ${round.roundNumber - 1} results not yet published`
      );
    }
  }

  await db
    .update(rounds)
    .set({ status: newStatus as "DRAFT" | "SUBMISSION_OPEN" | "SUBMISSION_LOCKED" | "JUDGING" | "RESULTS_PENDING" | "RESULTS_PUBLISHED" })
    .where(eq(rounds.id, roundId));

  // Update event's activeRoundId
  await db
    .update(events)
    .set({ activeRoundId: roundId })
    .where(eq(events.id, eventId));

  return { roundId, previousStatus: round.status, newStatus };
}

/**
 * Delete a round (only DRAFT rounds).
 */
export async function deleteRound(roundId: string) {
  const round = await getRoundById(roundId);
  if (!round) throw new Error("Round not found");
  if (round.status !== "DRAFT") {
    throw new Error("Can only delete rounds in DRAFT status");
  }

  await db.delete(rounds).where(eq(rounds.id, roundId));
}

/**
 * Get problem statements for a round (respects reveal time).
 */
export async function getProblemStatements(
  roundId: string,
  isOrganizer: boolean
) {
  const round = await getRoundById(roundId);
  if (!round) throw new Error("Round not found");

  // Organizers always see problems
  if (isOrganizer) {
    return {
      problems: round.problemStatements || [],
      revealed: true,
      revealAt: round.problemRevealAt,
    };
  }

  // Participants: enforce server-side reveal time
  if (round.problemRevealAt && new Date() < new Date(round.problemRevealAt)) {
    return {
      problems: [],
      revealed: false,
      revealAt: round.problemRevealAt,
      serverTime: new Date(),
    };
  }

  return {
    problems: round.problemStatements || [],
    revealed: true,
    revealAt: round.problemRevealAt,
  };
}
