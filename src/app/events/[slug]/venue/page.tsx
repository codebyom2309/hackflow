import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getEventRooms, getVenueStats } from "@/lib/services/desk.service";
import VenueManager from "./venue-manager";

export const metadata = {
  title: "Venue Management — HackFlow",
  description: "Manage rooms and desks for your hackathon event.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function VenuePage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

  const rooms = await getEventRooms(event.id);
  const stats = await getVenueStats(event.id);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>
      <VenueManager
        eventSlug={slug}
        initialRooms={rooms}
        initialStats={stats}
      />
    </main>
  );
}
