import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getEventRounds } from "@/lib/services/round.service";
import ManagementLayout from "./management-layout";
import OrganizerDashboard from "./organizer-dashboard";

export const metadata = {
  title: "Event Management — HackFlow",
  description: "Manage rounds, teams, judging, and results for your hackathon.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function ManagePage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/manage`);
  }

  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  await requireRole(session.user.id, event.id, "ORGANIZER");

  const rounds = await getEventRounds(event.id);

  return (
    <ManagementLayout
      eventTitle={event.title}
      eventSlug={event.slug}
      eventStatus={event.status}
    >
      <OrganizerDashboard event={event} rounds={rounds} />
    </ManagementLayout>
  );
}
