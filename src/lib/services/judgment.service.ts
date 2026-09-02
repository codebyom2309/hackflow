import { db } from "@/lib/db";
import {
  judgmentScores,
  judgmentCorrections,
  evaluationCriteria,
  teams,
  rounds,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Judgment Service
// ============================================

interface ScoreInput {
  criteriaId: string;
  score: number;
}

interface JudgmentInput {
  teamId: string;
  roundId: string;
  scores: ScoreInput[];
  idempotencyKey: string;
}

/**
 * Submit judgment scores for a team.
 */
export async function submitJudgment(
  eventId: string,
  judgeId: string,
  input: JudgmentInput
) {
  // 1. Validate round is in JUDGING state
  const round = await db.query.rounds.findFirst({
    where: and(eq(rounds.id, input.roundId), eq(rounds.eventId, eventId)),
  });
  if (!round) throw new Error("Round not found");
  if (round.status !== "JUDGING") {
    throw new Error("Round is not in JUDGING phase");
  }

  // 2. Validate team exists
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, input.teamId), eq(teams.eventId, eventId)),
  });
  if (!team) throw new Error("Team not found");

  // 3. Check idempotency — if same key exists, return existing
  const existingByKey = await db.query.judgmentScores.findFirst({
    where: and(
      eq(judgmentScores.judgeId, judgeId),
      eq(judgmentScores.teamId, input.teamId),
      eq(judgmentScores.roundId, input.roundId),
      eq(judgmentScores.idempotencyKey, input.idempotencyKey)
    ),
  });
  if (existingByKey) {
    return { duplicate: true, message: "Judgment already submitted with this key" };
  }

  // 4. Load criteria for validation
  const criteria = await db.query.evaluationCriteria.findMany({
    where: eq(evaluationCriteria.roundId, input.roundId),
  });
  const criteriaMap = new Map(criteria.map((c) => [c.id, c]));

  // 5. Validate and insert scores
  const scoreRecords = input.scores.map((s) => {
    const criterion = criteriaMap.get(s.criteriaId);
    if (!criterion) throw new Error(`Unknown criterion: ${s.criteriaId}`);
    if (s.score < 0 || s.score > criterion.maxPoints) {
      throw new Error(
        `Score ${s.score} out of range [0, ${criterion.maxPoints}] for "${criterion.name}"`
      );
    }
    return {
      id: crypto.randomUUID(),
      teamId: input.teamId,
      judgeId,
      roundId: input.roundId,
      criteriaId: s.criteriaId,
      eventId,
      score: s.score,
      idempotencyKey: input.idempotencyKey,
    };
  });

  if (scoreRecords.length > 0) {
    await db.insert(judgmentScores).values(scoreRecords);
  }

  return { duplicate: false, count: scoreRecords.length };
}

/**
 * Undo a judgment (soft-delete all scores for a team+judge+round).
 * Only allowed within undo window.
 */
export async function undoJudgment(
  eventId: string,
  judgeId: string,
  teamId: string,
  roundId: string
) {
  const scores = await db.query.judgmentScores.findMany({
    where: and(
      eq(judgmentScores.judgeId, judgeId),
      eq(judgmentScores.teamId, teamId),
      eq(judgmentScores.roundId, roundId),
      eq(judgmentScores.eventId, eventId)
    ),
  });

  if (scores.length === 0) {
    throw new Error("No judgment found to undo");
  }

  // Check undo window (10 seconds from creation)
  const oldest = scores[0]?.createdAt;
  if (oldest && Date.now() - new Date(oldest).getTime() > 10_000) {
    throw new Error("Undo window expired (10 seconds)");
  }

  // Delete scores
  for (const s of scores) {
    await db.delete(judgmentScores).where(eq(judgmentScores.id, s.id));
  }

  return { undone: scores.length };
}

/**
 * Correct a single judgment score (creates audit trail).
 */
export async function correctScore(
  judgmentId: string,
  correctedScore: number,
  correctedBy: string,
  reason: string
) {
  const score = await db.query.judgmentScores.findFirst({
    where: eq(judgmentScores.id, judgmentId),
  });
  if (!score) throw new Error("Judgment score not found");

  // Create correction record
  await db.insert(judgmentCorrections).values({
    id: crypto.randomUUID(),
    judgmentId,
    originalScore: score.score,
    correctedScore,
    correctedBy,
    reason,
  });

  // Update the score
  await db
    .update(judgmentScores)
    .set({ score: correctedScore })
    .where(eq(judgmentScores.id, judgmentId));

  return { original: score.score, corrected: correctedScore };
}

/**
 * Get judge's progress for a round (how many teams evaluated).
 */
export async function getJudgeProgress(
  eventId: string,
  judgeId: string,
  roundId: string
) {
  const allTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });

  const myScores = await db.query.judgmentScores.findMany({
    where: and(
      eq(judgmentScores.judgeId, judgeId),
      eq(judgmentScores.roundId, roundId),
      eq(judgmentScores.eventId, eventId)
    ),
  });

  const evaluatedTeamIds = new Set(myScores.map((s) => s.teamId));

  return {
    total: allTeams.length,
    evaluated: evaluatedTeamIds.size,
    pending: allTeams.length - evaluatedTeamIds.size,
    rate: allTeams.length > 0
      ? ((evaluatedTeamIds.size / allTeams.length) * 100)
      : 0,
    evaluatedTeamIds: Array.from(evaluatedTeamIds),
  };
}

/**
 * Get the full scoring matrix for a round (organizer view).
 */
export async function getScoringMatrix(eventId: string, roundId: string) {
  const allTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });

  const criteria = await db.query.evaluationCriteria.findMany({
    where: eq(evaluationCriteria.roundId, roundId),
    orderBy: (c, { asc }) => [asc(c.displayOrder)],
  });

  const allScores = await db.query.judgmentScores.findMany({
    where: and(
      eq(judgmentScores.roundId, roundId),
      eq(judgmentScores.eventId, eventId)
    ),
  });

  // Build matrix: team → criterion → judge scores
  const matrix = allTeams.map((team) => {
    const teamScores = allScores.filter((s) => s.teamId === team.id);
    const judgeIds = [...new Set(teamScores.map((s) => s.judgeId))];

    const criteriaScores = criteria.map((c) => {
      const scoresForCriterion = teamScores.filter((s) => s.criteriaId === c.id);
      const avg =
        scoresForCriterion.length > 0
          ? scoresForCriterion.reduce((sum, s) => sum + s.score, 0) /
            scoresForCriterion.length
          : null;

      return {
        criteriaId: c.id,
        criteriaName: c.name,
        maxPoints: c.maxPoints,
        weight: c.weight,
        scores: scoresForCriterion.map((s) => ({
          judgeId: s.judgeId,
          score: s.score,
        })),
        average: avg,
      };
    });

    // Weighted total
    const weightedTotal = criteriaScores.reduce((sum, cs) => {
      if (cs.average === null) return sum;
      return sum + cs.average * Number(cs.weight);
    }, 0);

    return {
      teamId: team.id,
      teamName: team.name,
      status: team.status,
      judgeCount: judgeIds.length,
      criteriaScores,
      weightedTotal,
    };
  });

  // Sort by weighted total descending
  matrix.sort((a, b) => b.weightedTotal - a.weightedTotal);

  return { criteria, matrix };
}

/**
 * Calculate rankings for a round.
 */
export async function calculateRankings(eventId: string, roundId: string) {
  const { matrix } = await getScoringMatrix(eventId, roundId);

  return matrix.map((entry, idx) => ({
    rank: idx + 1,
    teamId: entry.teamId,
    teamName: entry.teamName,
    weightedTotal: Math.round(entry.weightedTotal * 100) / 100,
    judgeCount: entry.judgeCount,
  }));
}
