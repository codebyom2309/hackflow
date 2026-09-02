import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getAttendanceRoster } from "@/lib/services/attendance.service";
import CoordinatorScanner from "./coordinator-scanner";

export const metadata = {
  title: "Coordinator Scanner — HackFlow",
  description: "Live QR scanner and check-in roster for hackathon coordinators.",
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

  await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

  const initialData = await getAttendanceRoster(event.id);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>
      <CoordinatorScanner
        event={event}
        initialRoster={initialData.roster}
        initialStats={initialData.stats}
      />
    </main>
  );
}
