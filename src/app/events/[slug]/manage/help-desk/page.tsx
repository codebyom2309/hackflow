import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getEventHelpRequests, getHelpRequestStats } from "@/lib/services/help-request.service";
import ManagementLayout from "../management-layout";
import HelpDeskManager from "./help-desk-manager";

export const metadata = {
  title: "Help Desk & Participant Triage — HackFlow",
  description: "Global organizer command center for participant help requests and support tickets.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function HelpDeskPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/help-desk`);
  }

  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  await requireRole(session.user.id, event.id, "ORGANIZER");

  const [initialRequests, initialStats] = await Promise.all([
    getEventHelpRequests(event.id),
    getHelpRequestStats(event.id),
  ]);

  return (
    <ManagementLayout
      eventTitle={event.title}
      eventSlug={event.slug}
      eventStatus={event.status}
    >
      <HelpDeskManager
        event={{ id: event.id, title: event.title, slug: event.slug }}
        initialRequests={initialRequests}
        initialStats={initialStats}
      />
    </ManagementLayout>
  );
}
