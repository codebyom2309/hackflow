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

  try {
    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");
  } catch (err) {
    if (err instanceof AuthError) {
      const userRole = (await getUserEventRole(session.user.id, event.id)) || "PARTICIPANT";
      redirect(`/unauthorized?role=${userRole}&required=COORDINATOR&slug=${slug}`);
    }
    throw err;
  }

  const initialData = await getAttendanceRoster(event.id);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-md)", paddingBottom: "var(--spacing-xxl)" }}>
      <CoordinatorScanner
        event={event}
        initialRoster={initialData.roster}
        initialStats={initialData.stats}
      />
    </main>
  );
}
