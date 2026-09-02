import { db } from "@/lib/db";
import { shortlists, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateRankings } from "./judgment.service";
import crypto from "crypto";

// ============================================
// Shortlisting Service (Level 26)
// ============================================

/**
 * Auto-compute and save shortlist for a round based on rankings.
 * shortlistCount from round config determines how many advance.
 */
export async function computeShortlist(
  eventId: string,
  roundId: string,
  shortlistCount: number
) {
  const rankings = await calculateRankings(eventId, roundId);

  // Clear any previous shortlist for this round
  await db
    .delete(shortlists)
    .where(and(eq(shortlists.roundId, roundId), eq(shortlists.eventId, eventId)));

  if (rankings.length === 0) return { saved: 0 };

  const records = rankings.map((r, idx) => ({
    id: crypto.randomUUID(),
    teamId: r.teamId,
    roundId,
    eventId,
    calculatedRank: r.rank,
    finalRank: null,
    totalScore: String(r.weightedTotal),
    isAdvancing: idx < shortlistCount,
  }));

  await db.insert(shortlists).values(records);

  // Update team statuses
  for (const rec of records) {
    await db
      .update(teams)
      .set({ status: rec.isAdvancing ? "SHORTLISTED" : "ELIMINATED" })
      .where(eq(teams.id, rec.teamId));
  }

  return {
    saved: records.length,
    advancing: records.filter((r) => r.isAdvancing).length,
    eliminated: records.filter((r) => !r.isAdvancing).length,
  };
}

/**
 * Get shortlist for a round.
 */
export async function getShortlist(roundId: string) {
  return db.query.shortlists.findMany({
    where: eq(shortlists.roundId, roundId),
    orderBy: (s, { asc }) => [asc(s.calculatedRank)],
  });
}

/**
 * Override a team's final rank (organizer override).
 */
export async function setFinalRank(
  shortlistId: string,
  finalRank: number | null
) {
  await db
    .update(shortlists)
    .set({ finalRank })
    .where(eq(shortlists.id, shortlistId));
}

/**
 * Publish results — set isAdvancing based on finalRank or calculatedRank vs shortlistCount.
 */
export async function publishResults(
  roundId: string,
  shortlistCount: number
) {
  const list = await getShortlist(roundId);

  for (const entry of list) {
    const rank = entry.finalRank ?? entry.calculatedRank;
    const isAdvancing = rank <= shortlistCount;

    await db
      .update(shortlists)
      .set({ isAdvancing })
      .where(eq(shortlists.id, entry.id));

    await db
      .update(teams)
      .set({ status: isAdvancing ? "SHORTLISTED" : "ELIMINATED" })
      .where(eq(teams.id, entry.teamId));
  }

  return { published: list.length };
}
