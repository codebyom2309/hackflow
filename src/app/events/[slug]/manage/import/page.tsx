import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import ManagementLayout from "../management-layout";
import ImportManager from "./import-manager";

export const metadata = {
  title: "Import Registrations — HackFlow",
  description: "Import team registrations from Excel or CSV files.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function ImportPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/import`);
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
      <ImportManager event={{ id: event.id, title: event.title, slug: event.slug }} />
    </ManagementLayout>
  );
}
