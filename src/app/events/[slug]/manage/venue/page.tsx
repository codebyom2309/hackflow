import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getEventRooms, getVenueStats } from "@/lib/services/desk.service";
import ManagementLayout from "../management-layout";
import VenueManager from "../../venue/venue-manager";

export const metadata = {
  title: "Venue & Desks — HackFlow",
  description: "Manage rooms and desks for your hackathon event.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function ManageVenuePage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/venue`);
  }

  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

  const rooms = await getEventRooms(event.id);
  const stats = await getVenueStats(event.id);

  return (
    <ManagementLayout
      eventTitle={event.title}
      eventSlug={event.slug}
      eventStatus={event.status}
    >
      <VenueManager
        eventSlug={slug}
        initialRooms={rooms}
        initialStats={stats}
      />
    </ManagementLayout>
  );
}
