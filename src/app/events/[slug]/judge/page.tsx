import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { getUserEventRole, requireRole, AuthError } from "@/lib/auth/guards";
import { getEventRounds } from "@/lib/services/round.service";
import { getAttendanceRoster } from "@/lib/services/attendance.service";
import { getJudgeAssignments } from "@/lib/services/judge-assignment.service";
import JudgeDashboard from "./judge-dashboard";

export const metadata = {
  title: "Judge Evaluation Workspace — HackFlow",
  description: "Evaluate hackathon submissions, criteria scoring, and progress tracking.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function JudgePage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/judge`);
  }

  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  try {
    await requireRole(session.user.id, event.id, "JUDGE", "ORGANIZER");
  } catch (err) {
    if (err instanceof AuthError) {
      const userRole = (await getUserEventRole(session.user.id, event.id)) || "PARTICIPANT";
      redirect(`/unauthorized?role=${userRole}&required=JUDGE&slug=${slug}`);
    }
    throw err;
  }

  let rounds = await getEventRounds(event.id);

  // Auto-initialize Round 1 if event has no evaluation rounds configured yet
  if (rounds.length === 0) {
    try {
      const { createRound } = await import("@/lib/services/round.service");
      const { addCriterion } = await import("@/lib/services/criteria.service");
      const { db } = await import("@/lib/db");
      const { rounds: roundsTable } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const round = await createRound(event.id, {
        roundNumber: 1,
        title: "Round 1: Preliminary Evaluation",
      });
      await db
        .update(roundsTable)
        .set({ status: "JUDGING" })
        .where(eq(roundsTable.id, round.id));

      await addCriterion(round.id, {
        name: "Technical Complexity & Execution",
        description: "Architecture, engineering rigor, and implementation feasibility",
        maxPoints: 10,
        weight: 1,
      });
      await addCriterion(round.id, {
        name: "Innovation & Originality",
        description: "Creativity, novelty, and fresh thinking in the domain",
        maxPoints: 10,
        weight: 1,
      });
      await addCriterion(round.id, {
        name: "UI / UX & Design Polish",
        description: "Visual aesthetics, responsive layout, and intuitive flow",
        maxPoints: 10,
        weight: 1,
      });
      await addCriterion(round.id, {
        name: "Presentation & Impact",
        description: "Pitch delivery, problem significance, and value proposition",
        maxPoints: 10,
        weight: 1,
      });

      rounds = await getEventRounds(event.id);
    } catch (e) {
      console.error("Auto-initializing round 1 failed:", e);
    }
  }

  const { roster } = await getAttendanceRoster(event.id);

  // Get the active round (JUDGING status) to check judge assignments
  const activeRound = rounds.find((r) => r.status === "JUDGING") || rounds[0] || null;

  // Get judge-specific assignments if any exist for this round
  let assignedTeamIds: string[] | null = null;
  if (activeRound) {
    try {
      const assignments = await getJudgeAssignments(session.user.id, activeRound.id);
      if (assignments.length > 0) {
        assignedTeamIds = assignments.map((a) => a.teamId);
      }
    } catch {
      // Fall through to show all
    }
  }

  return (
    <main style={{ width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "12px 14px 80px" }}>
      <JudgeDashboard
        event={event}
        rounds={rounds}
        roster={roster}
        assignedTeamIds={assignedTeamIds}
      />
    </main>
  );
}
