import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import { getParticipantExperience } from "@/lib/services/participant-experience.service";
import ManagementLayout from "../management-layout";
import ExperienceBuilder from "./experience-builder";

export const metadata = {
  title: "Participant Experience Builder — HackFlow",
  description: "Configure, preview, and publish the participant-facing website and mobile experience.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function ExperiencePage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/experience`);
  }

  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");

  await requireRole(session.user.id, event.id, "ORGANIZER");

  const initialExperience = await getParticipantExperience(event.id);

  return (
    <ManagementLayout
      eventTitle={event.title}
      eventSlug={event.slug}
      eventStatus={event.status}
    >
      <ExperienceBuilder
        event={{ id: event.id, title: event.title, slug: event.slug }}
        initialConfig={initialExperience?.config || null}
        initialPublished={initialExperience?.isPublished ?? true}
      />
    </ManagementLayout>
  );
}
