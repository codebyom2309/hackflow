import { auth } from "@/lib/auth/config";
import { getEventBySlug } from "@/lib/services/event.service";
import { getEventAnnouncements } from "@/lib/services/announcement.service";
import { getEventRounds } from "@/lib/services/round.service";
import { db } from "@/lib/db";
import { eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/live — Server-Sent Events stream for live event updates.
 *
 * Pushes:
 * - event:status — event status changes
 * - round:status — active round status changes
 * - announcement — new announcements
 * - ping — keepalive every 25s
 *
 * Clients reconnect automatically on disconnect (EventSource default).
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return new Response("Event not found", { status: 404 });
  }

  // Verify membership
  const membership = await db.query.eventMemberships.findFirst({
    where: and(
      eq(eventMemberships.userId, session.user.id),
      eq(eventMemberships.eventId, event.id)
    ),
  });
  if (!membership) {
    return new Response("Not a member of this event", { status: 403 });
  }

  // Get initial state
  const rounds = await getEventRounds(event.id);
  const announcements = await getEventAnnouncements(event.id);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function send(eventType: string, data: unknown) {
        const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch {
          // Client disconnected
        }
      }

      // Send initial state immediately
      send("init", {
        event: {
          id: event.id,
          title: event.title,
          status: event.status,
          slug: event.slug,
        },
        rounds: rounds.map((r) => ({
          id: r.id,
          roundNumber: r.roundNumber,
          title: r.title,
          status: r.status,
          submissionDeadline: r.submissionDeadline,
          problemRevealAt: r.problemRevealAt,
        })),
        announcements: announcements.slice(0, 10), // Latest 10
        serverTime: new Date().toISOString(),
      });

      // Polling loop — poll DB every 15s and push changes
      let previousEventStatus = event.status;
      const previousRoundStatuses = new Map(rounds.map((r) => [r.id, r.status]));
      let previousAnnouncementCount = announcements.length;

      const intervalId = setInterval(async () => {
        try {
          // Check event status
          const freshEvent = await getEventBySlug(slug);
          if (freshEvent && freshEvent.status !== previousEventStatus) {
            previousEventStatus = freshEvent.status;
            send("event:status", { status: freshEvent.status });
          }

          // Check round statuses
          const freshRounds = await getEventRounds(event.id);
          for (const r of freshRounds) {
            if (previousRoundStatuses.get(r.id) !== r.status) {
              previousRoundStatuses.set(r.id, r.status);
              send("round:status", {
                roundId: r.id,
                roundNumber: r.roundNumber,
                status: r.status,
              });
            }
          }

          // Check new announcements
          const freshAnnouncements = await getEventAnnouncements(event.id);
          if (freshAnnouncements.length > previousAnnouncementCount) {
            const newOnes = freshAnnouncements.slice(
              0,
              freshAnnouncements.length - previousAnnouncementCount
            );
            for (const a of newOnes) {
              send("announcement", a);
            }
            previousAnnouncementCount = freshAnnouncements.length;
          }

          // Keepalive ping
          send("ping", { t: Date.now() });
        } catch {
          clearInterval(intervalId);
          try { controller.close(); } catch { /* closed */ }
        }
      }, 15_000);

      // Cleanup on disconnect
      return () => {
        clearInterval(intervalId);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
