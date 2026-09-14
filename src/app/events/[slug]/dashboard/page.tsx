import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { getRegistration } from "@/lib/services/registration.service";
import { generateQRPayload, generateQRCodeDataURL } from "@/lib/services/qr.service";
import { getTeamCertificates } from "@/lib/services/certificate.service";
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

  // getRegistration now handles email-based matching for imported teams
  // It checks: leaderId → leaderEmail → teamMembers.email
  // and auto-claims leadership/membership if found
  const reg = await getRegistration(session.user.id, event.id);
  if (!reg?.team) {
    redirect(`/events/${slug}`);
  }

  const qrPayload = generateQRPayload(event.id, reg.team.id, event.qrSecret);
  const qrDataUrl = await generateQRCodeDataURL(qrPayload);

  // Fetch certificates if generated
  let certificates: Array<{
    id: string;
    recipientName: string;
    teamName: string | null;
    type: string;
    verificationCode: string;
    generatedAt: Date | null;
  }> = [];

  try {
    const certs = await getTeamCertificates(reg.team.id, event.id);
    certificates = certs.map((c) => ({
      id: c.id,
      recipientName: c.recipientName,
      teamName: c.teamName,
      type: c.type,
      verificationCode: c.verificationCode,
      generatedAt: c.generatedAt,
    }));
  } catch {
    // Graceful fallback if certificates query fails
  }

  // Fetch existing help requests for this team
  let initialHelpRequests: any[] = [];
  try {
    const { getParticipantHelpRequests } = await import("@/lib/services/help-request.service");
    initialHelpRequests = await getParticipantHelpRequests(event.id, reg.team.id);
  } catch {
    // Graceful fallback
  }

  return (
    <main style={{ width: "100%", minHeight: "100vh" }}>
      <ParticipantDashboard
        event={event}
        team={reg.team}
        members={reg.members}
        desk={reg.desk}
        qrDataUrl={qrDataUrl}
        certificates={certificates}
        initialHelpRequests={initialHelpRequests}
      />
    </main>
  );
}
