import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { db } from "@/lib/db";
import { shortlists, teams, rounds } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/results
 * Get published results. Available to all authenticated event members.
 * Query: ?roundId=... (optional, defaults to latest published)
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const roundIdParam = req.nextUrl.searchParams.get("roundId");

    // Get published rounds
    const publishedRounds = await db.query.rounds.findMany({
      where: and(
        eq(rounds.eventId, event.id),
        eq(rounds.status, "RESULTS_PUBLISHED")
      ),
    });

    if (publishedRounds.length === 0) {
      return NextResponse.json({
        data: { published: false, rounds: [], rankings: [] },
      });
    }

    const targetRound = roundIdParam
      ? publishedRounds.find((r) => r.id === roundIdParam)
      : publishedRounds[publishedRounds.length - 1]; // latest

    if (!targetRound) {
      return NextResponse.json({
        data: { published: false, rounds: publishedRounds, rankings: [] },
      });
    }

    // Get shortlists for this round
    const roundShortlists = await db.query.shortlists.findMany({
      where: and(
        eq(shortlists.eventId, event.id),
        eq(shortlists.roundId, targetRound.id)
      ),
    });

    // Enrich with team names
    const rankings = [];
    for (const s of roundShortlists) {
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, s.teamId),
      });
      rankings.push({
        rank: s.finalRank ?? s.calculatedRank,
        teamId: s.teamId,
        teamName: team?.name || "Unknown",
        teamStatus: team?.status || "",
        college: team?.college || "",
        totalScore: s.totalScore,
        isAdvancing: s.isAdvancing,
      });
    }

    // Sort by rank
    rankings.sort((a, b) => a.rank - b.rank);

    return NextResponse.json({
      data: {
        published: true,
        round: {
          id: targetRound.id,
          roundNumber: targetRound.roundNumber,
          title: targetRound.title,
        },
        rounds: publishedRounds.map((r) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          title: r.title,
        })),
        rankings,
      },
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
