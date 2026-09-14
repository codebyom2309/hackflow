import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { events, eventMemberships, teams, teamMembers, judgeAssignments, users } from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ role?: string; callbackUrl?: string }>;

export default async function ResolveRolePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const { role: rawRole, callbackUrl } = await searchParams;

  if (!session?.user?.id || !session?.user?.email) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl || "/events")}`);
  }

  const userId = session.user.id;
  const userEmail = session.user.email.toLowerCase().trim();
  const targetRole = (rawRole || "PARTICIPANT").toUpperCase();

  // If a specific deep link was requested (and isn't the generic /events), honor it after verifying access
  if (callbackUrl && callbackUrl !== "/events" && !callbackUrl.startsWith("/auth")) {
    redirect(callbackUrl);
  }

  // ==========================================
  // 1. ORGANIZER VERIFICATION
  // ==========================================
  if (targetRole === "ORGANIZER") {
    // Find events created by user
    const createdEvents = await db.query.events.findMany({
      where: eq(events.organizerId, userId),
    });

    // Find events where user is explicitly added as ORGANIZER
    const memberships = await db.query.eventMemberships.findMany({
      where: and(
        eq(eventMemberships.userId, userId),
        eq(eventMemberships.role, "ORGANIZER")
      ),
    });

    const eventIds = new Set<string>();
    createdEvents.forEach((e) => eventIds.add(e.id));
    memberships.forEach((m) => eventIds.add(m.eventId));

    if (eventIds.size === 1) {
      const singleEventId = Array.from(eventIds)[0];
      const singleEvent = createdEvents.find((e) => e.id === singleEventId) ||
        (await db.query.events.findFirst({ where: eq(events.id, singleEventId) }));
      if (singleEvent) {
        redirect(`/events/${singleEvent.slug}/manage`);
      }
    }

    // Multiple or 0 organized events -> send to Events Hub in Organizer context
    redirect(`/events?role=ORGANIZER`);
  }

  // ==========================================
  // 2. JUDGE VERIFICATION
  // ==========================================
  if (targetRole === "JUDGE") {
    // Check event memberships
    const judgeMemberships = await db.query.eventMemberships.findMany({
      where: and(
        eq(eventMemberships.userId, userId),
        eq(eventMemberships.role, "JUDGE")
      ),
    });

    // Also check direct judgeAssignments table
    const assignments = await db.query.judgeAssignments.findMany({
      where: eq(judgeAssignments.judgeId, userId),
    });

    const eventIds = new Set<string>();
    judgeMemberships.forEach((m) => eventIds.add(m.eventId));
    assignments.forEach((a) => eventIds.add(a.eventId));

    if (eventIds.size === 0) {
      // User is NOT registered as a Judge anywhere
      redirect(
        `/unauthorized?reason=NOT_A_JUDGE&email=${encodeURIComponent(userEmail)}&role=JUDGE`
      );
    }

    if (eventIds.size === 1) {
      const singleEventId = Array.from(eventIds)[0];
      const singleEvent = await db.query.events.findFirst({
        where: eq(events.id, singleEventId),
      });
      if (singleEvent) {
        redirect(`/events/${singleEvent.slug}/judge`);
      }
    }

    redirect(`/events?role=JUDGE`);
  }

  // ==========================================
  // 3. COORDINATOR / STAFF VERIFICATION
  // ==========================================
  if (targetRole === "COORDINATOR") {
    const staffMemberships = await db.query.eventMemberships.findMany({
      where: and(
        eq(eventMemberships.userId, userId),
        eq(eventMemberships.role, "COORDINATOR")
      ),
    });

    if (staffMemberships.length === 0) {
      redirect(
        `/unauthorized?reason=NOT_A_COORDINATOR&email=${encodeURIComponent(userEmail)}&role=COORDINATOR`
      );
    }

    if (staffMemberships.length === 1) {
      const singleEvent = await db.query.events.findFirst({
        where: eq(events.id, staffMemberships[0].eventId),
      });
      if (singleEvent) {
        redirect(`/events/${singleEvent.slug}/coordinator`);
      }
    }

    redirect(`/events?role=COORDINATOR`);
  }

  // ==========================================
  // 4. PARTICIPANT VERIFICATION
  // ==========================================
  // Find teams where user is leader or member
  const memberRecords = await db.query.teamMembers.findMany({
    where: eq(teamMembers.email, userEmail),
  });

  const leaderTeams = await db.query.teams.findMany({
    where: eq(teams.leaderEmail, userEmail),
  });

  const teamIds = new Set<string>();
  memberRecords.forEach((m) => teamIds.add(m.teamId));
  leaderTeams.forEach((t) => teamIds.add(t.id));

  if (teamIds.size > 0) {
    const allUserTeams = await db.query.teams.findMany({
      where: inArray(teams.id, Array.from(teamIds)),
    });

    const eventIds = new Set<string>();
    allUserTeams.forEach((t) => eventIds.add(t.eventId));

    if (eventIds.size === 1) {
      const singleEvent = await db.query.events.findFirst({
        where: eq(events.id, Array.from(eventIds)[0]),
      });
      if (singleEvent) {
        redirect(`/events/${singleEvent.slug}/dashboard`);
      }
    }
  }

  // Default: Open the Participant Events Hub
  redirect(`/events?role=PARTICIPANT`);
}
