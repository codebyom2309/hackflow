import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import ManagementLayout from "../management-layout";
import CertificateManager from "./certificate-manager";

export const metadata = { title: "Certificates — HackFlow" };
type Params = { params: Promise<{ slug: string }> };

export default async function ManageCertificatesPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/certificates`);
  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");
  await requireRole(session.user.id, event.id, "ORGANIZER");

  return (
    <ManagementLayout eventTitle={event.title} eventSlug={event.slug} eventStatus={event.status}>
      <CertificateManager slug={event.slug} eventName={event.title} />
    </ManagementLayout>
  );
}
