import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { getScoringMatrix, calculateRankings } from "@/lib/services/judgment.service";
import { handleApiError } from "@/lib/api/response";

type Params = { params: Promise<{ slug: string; roundId: string }> };

/**
 * GET /api/events/[slug]/rounds/[roundId]/matrix — Full scoring matrix (ORGANIZER)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { slug, roundId } = await params;
    const event = await getEventBySlug(slug);
    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await requireRole(session.user.id, event.id, "ORGANIZER");

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    if (format === "csv") {
      const { criteria, matrix } = await getScoringMatrix(event.id, roundId);

      const headers = [
        "Rank",
        "Team",
        "Status",
        "Judges",
        ...criteria.map((c) => `${c.name} (avg)`),
        "Weighted Total",
      ];

      const rows = matrix.map((entry, idx) => [
        idx + 1,
        `"${entry.teamName.replace(/"/g, '""')}"`,
        `"${entry.status}"`,
        entry.judgeCount,
        ...entry.criteriaScores.map((cs) =>
          cs.average !== null ? cs.average.toFixed(2) : "N/A"
        ),
        entry.weightedTotal.toFixed(2),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="scoring-matrix-${event.slug}.csv"`,
        },
      });
    }

    const data = await getScoringMatrix(event.id, roundId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, "GET /api/events/[slug]/rounds/[roundId]/matrix");
  }
}
