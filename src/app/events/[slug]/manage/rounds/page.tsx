import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import ManagementLayout from "../management-layout";

import { getEventRounds } from "@/lib/services/round.service";
import RoundManager from "./round-manager";

export const metadata = {
  title: "Rounds Management — HackFlow",
};

type Params = { params: Promise<{ slug: string }> };

export default async function RoundsPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/rounds`);
  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");
  await requireRole(session.user.id, event.id, "ORGANIZER");

  const rounds = await getEventRounds(event.id);

  return (
    <ManagementLayout eventTitle={event.title} eventSlug={event.slug} eventStatus={event.status}>
      <RoundManager slug={event.slug} initialRounds={rounds} />
    </ManagementLayout>
  );
}
