import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getEventRounds } from "@/lib/services/round.service";
import { getAttendanceRoster } from "@/lib/services/attendance.service";
import { getJudgeAssignments } from "@/lib/services/judge-assignment.service";
import JudgeDashboard from "./judge-dashboard";

export const metadata = {
  title: "Judge Dashboard — HackFlow",
  description: "Scan teams, evaluate submissions, and submit scores.",
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

  await requireRole(session.user.id, event.id, "JUDGE", "ORGANIZER");

  const rounds = await getEventRounds(event.id);
  const { roster } = await getAttendanceRoster(event.id);

  // Get the active round (JUDGING status) to check judge assignments
  const activeRound = rounds.find((r) => r.status === "JUDGING") || rounds[0] || null;

  // Get judge-specific assignments if any exist for this round
  let assignedTeamIds: string[] | null = null;
  if (activeRound) {
    try {
      const assignments = await getJudgeAssignments(session.user.id, activeRound.id);
      if (assignments.length > 0) {
        // Only filter if explicit assignments exist — if none, judge sees all teams
        assignedTeamIds = assignments.map((a) => a.teamId);
      }
    } catch {
      // If no assignments table data, fall through to show all
    }
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>
      <JudgeDashboard
        event={event}
        rounds={rounds}
        roster={roster}
        assignedTeamIds={assignedTeamIds}
      />
    </main>
  );
}
