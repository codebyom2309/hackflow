import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { getUserEventRole } from "@/lib/auth/guards";
import { resolveUserTeam, claimTeamLeadership, claimTeamMembership } from "@/lib/services/user-mapping.service";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import EventPortal from "./event-portal";

export const metadata = {
  title: "Event Details — HackFlow",
  description: "View hackathon event details, schedule, and team registration.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function EventPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}`);
  }

  const event = await getEventBySlug(slug);
  if (!event) {
    redirect("/events");
  }

  // Check user role in this event
  const role = await getUserEventRole(session.user.id, event.id);
  const isOrganizer = event.organizerId === session.user.id || role === "ORGANIZER";

  // If user is an organizer, take them straight to event management
  if (isOrganizer) {
    redirect(`/events/${slug}/manage`);
  }

  // If user is staff, direct them to their specialized views
  if (role === "COORDINATOR") {
    redirect(`/events/${slug}/coordinator`);
  }

  if (role === "JUDGE") {
    redirect(`/events/${slug}/judge`);
  }

  if (role === "PARTICIPANT") {
    redirect(`/events/${slug}/dashboard`);
  }

  // No existing role — try email-based matching for imported teams
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (user?.email) {
    const teamMatch = await resolveUserTeam(user.email, event.id);
    if (teamMatch) {
      // Auto-claim and redirect to dashboard
      if (teamMatch.isLeader) {
        await claimTeamLeadership(session.user.id, teamMatch.team.id, event.id);
      } else {
        await claimTeamMembership(session.user.id, event.id);
      }
      redirect(`/events/${slug}/dashboard`);
    }
  }

  // Fetch organizer-published participant experience config
  const { getParticipantExperience } = await import("@/lib/services/participant-experience.service");
  const experienceData = await getParticipantExperience(event.id);

  // Default: Event portal for authenticated users wishing to register or view event
  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-xxl)" }}>
      <EventPortal
        event={event}
        userRole={role}
        experienceConfig={experienceData?.config || null}
        currentUser={{
          id: session.user.id,
          name: session.user.name || "",
          email: session.user.email || "",
        }}
      />
    </main>
  );
}
