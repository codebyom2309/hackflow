import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getUserEventsHubData } from "@/lib/services/event.service";
import EventsList from "./events-list";

export const metadata = {
  title: "Hackathons Hub & Participant Portal — HackFlow",
  description: "Access your hackathon teams, persistent QR passes, assigned desks, and organizer consoles.",
};

export default async function EventsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/events");
  }

  const hubData = await getUserEventsHubData(session.user.id);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-xxl)" }}>
      <EventsList hubData={hubData} userEmail={session.user.email} />
    </main>
  );
}
