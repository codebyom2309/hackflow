import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { getUserEventRole } from "@/lib/auth/guards";
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

  // Default: Event portal for authenticated users wishing to register or view event
  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>
      <EventPortal event={event} userRole={role} />
    </main>
  );
}
