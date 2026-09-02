import { auth } from "@/lib/auth/config";
import { getInvitationPreview } from "@/lib/services/invitation.service";
import JoinClient from "./join-client";

export const metadata = {
  title: "Join Event Staff — HackFlow",
  description: "Accept your invitation to join the hackathon organizing or judging team.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function JoinPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  const preview = token ? await getInvitationPreview(token) : null;

  return (
    <main className="container" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <JoinClient
        token={token}
        preview={preview}
        isAuthenticated={Boolean(session?.user?.id)}
      />
    </main>
  );
}
