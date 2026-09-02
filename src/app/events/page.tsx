import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getUserEvents } from "@/lib/services/event.service";
import EventsList from "./events-list";

export const metadata = {
  title: "My Events — HackFlow",
  description: "Manage your hackathon events.",
};

export default async function EventsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/events");
  }

  const events = await getUserEvents(session.user.id);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xxl)" }}>
      <EventsList events={events} />
    </main>
  );
}
