import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { getUserEventRole, requireRole, AuthError } from "@/lib/auth/guards";
import { getAttendanceRoster } from "@/lib/services/attendance.service";
import CoordinatorScanner from "./coordinator-scanner";

export const metadata = {
  title: "Coordinator & Staff Operations — HackFlow",
  description: "Live QR scanner, attendance roster, and help desk for hackathon staff.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function CoordinatorPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/coordinator`);
  }

  const event = await getEventBySlug(slug);
  if (!event) {
    redirect("/events");
  }

  // Direct organizer check (by ID or email) or explicit role check
  let isOwner = event.organizerId === session.user.id;
  if (!isOwner && session.user.email) {
    try {
      const { users } = await import("@/lib/db/schema/users");
      const { eq } = await import("drizzle-orm");
      const { db } = await import("@/lib/db");
      const owner = await db.query.users.findFirst({
        where: eq(users.id, event.organizerId),
      });
      if (owner?.email && owner.email.toLowerCase() === session.user.email.toLowerCase()) {
        isOwner = true;
      }
    } catch {
      // ignore
    }
  }

  if (!isOwner) {
    try {
      await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");
    } catch (err: any) {
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
        throw err;
      }
      try {
        const userRole = (await getUserEventRole(session.user.id, event.id)) || "PARTICIPANT";
        redirect(`/unauthorized?role=${userRole}&required=COORDINATOR&slug=${slug}`);
      } catch (redirectErr: any) {
        if (redirectErr?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw redirectErr;
        }
        redirect(`/events/${slug}`);
      }
    }
  }

  // Resilient attendance data loading
  let initialRoster: any[] = [];
  let initialStats = { total: 0, checkedIn: 0, pending: 0, rate: 0 };

  try {
    const initialData = await getAttendanceRoster(event.id);
    if (initialData) {
      initialRoster = (initialData.roster || []).map((t) => ({
        ...t,
        checkedInAt: t.checkedInAt ? new Date(t.checkedInAt).toISOString() : null,
      }));
      if (initialData.stats) {
        initialStats = {
          total: Number(initialData.stats.total || 0),
          checkedIn: Number(initialData.stats.checkedIn || 0),
          pending: Number(initialData.stats.pending || 0),
          rate: Number(initialData.stats.rate || 0),
        };
      }
    }
  } catch (err) {
    console.error("Failed to load initial attendance roster for coordinator:", err);
  }

  const safeEvent = {
    id: event.id,
    title: event.title || "Hackathon",
    slug: event.slug,
  };

  return (
    <main style={{ width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "12px 14px 80px" }}>
      <CoordinatorScanner
        event={safeEvent}
        initialRoster={initialRoster}
        initialStats={initialStats}
      />
    </main>
  );
}
