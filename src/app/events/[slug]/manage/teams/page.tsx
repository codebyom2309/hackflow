import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import ManagementLayout from "../management-layout";
import TeamManager from "./team-manager";

export const metadata = {
  title: "Team Management — HackFlow",
  description: "Manage teams, members, and registrations.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function TeamsPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/teams`);
  }

  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  await requireRole(session.user.id, event.id, "ORGANIZER");

  return (
    <ManagementLayout
      eventTitle={event.title}
      eventSlug={event.slug}
      eventStatus={event.status}
    >
      <TeamManager event={{ id: event.id, title: event.title, slug: event.slug }} />
    </ManagementLayout>
  );
}
