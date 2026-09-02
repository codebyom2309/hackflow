import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { getRegistration } from "@/lib/services/registration.service";
import { generateQRPayload, generateQRCodeDataURL } from "@/lib/services/qr.service";
import ParticipantDashboard from "./participant-dashboard";

export const metadata = {
  title: "Participant Dashboard — HackFlow",
  description: "Your hackathon team dashboard, QR pass, desk allocation, and live event updates.",
};

type Params = { params: Promise<{ slug: string }> };

export default async function ParticipantDashboardPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/events/${slug}/dashboard`);
  }

  const event = await getEventBySlug(slug);
  if (!event) {
    redirect("/events");
  }

  const reg = await getRegistration(session.user.id, event.id);
  if (!reg?.team) {
    redirect(`/events/${slug}`);
  }

  const qrPayload = generateQRPayload(event.id, reg.team.id, event.qrSecret);
  const qrDataUrl = await generateQRCodeDataURL(qrPayload);

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>
      <ParticipantDashboard
        event={event}
        team={reg.team}
        members={reg.members}
        desk={reg.desk}
        qrDataUrl={qrDataUrl}
      />
    </main>
  );
}
