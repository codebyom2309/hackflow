import { db } from "@/lib/db";
import { certificates, teams, shortlists, teamMembers } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Certificate Service
// ============================================

type CertType = "PARTICIPANT" | "WINNER" | "RUNNER_UP" | "FINALIST" | "SPECIAL" | "VOLUNTEER" | "JUDGE" | "COORDINATOR";

/**
 * Generate a unique verification code for a certificate.
 */
function generateVerificationCode(): string {
  const bytes = crypto.randomBytes(12);
  return `HF-${bytes.toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-")}`;
}

/**
 * Generate certificate records for all teams in an event.
 * Type is determined from shortlist rank and event winnersCount.
 */
export async function generateCertificates(
  eventId: string,
  winnersCount: number = 3
) {
  // Get all teams
  const allTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });

  // Get all team members
  const eventTeamIds = allTeams.map((t) => t.id);
  const eventMembers = eventTeamIds.length > 0
    ? await db
        .select({
          teamId: teamMembers.teamId,
          name: teamMembers.name,
          email: teamMembers.email,
        })
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, eventTeamIds))
    : [];

  // Get latest shortlist
  const allShortlists = await db.query.shortlists.findMany({
    where: eq(shortlists.eventId, eventId),
  });

  // Build best rank per team
  const bestRank = new Map<string, number>();
  for (const s of allShortlists) {
    const rank = s.finalRank ?? s.calculatedRank;
    const existing = bestRank.get(s.teamId);
    if (!existing || rank < existing) {
      bestRank.set(s.teamId, rank);
    }
  }

  function getCertType(teamId: string): CertType {
    const rank = bestRank.get(teamId);
    if (!rank) return "PARTICIPANT";
    if (rank <= winnersCount) {
      if (rank === 1) return "WINNER";
      if (rank === 2) return "RUNNER_UP";
      return "FINALIST";
    }
    return "PARTICIPANT";
  }

  const records: Array<{
    id: string;
    eventId: string;
    teamId: string;
    recipientName: string;
    recipientEmail: string | null;
    type: CertType;
    verificationCode: string;
    generatedAt: Date;
  }> = [];

  for (const team of allTeams) {
    const certType = getCertType(team.id);
    const members = eventMembers.filter((m) => m.teamId === team.id);

    for (const member of members) {
      records.push({
        id: crypto.randomUUID(),
        eventId,
        teamId: team.id,
        recipientName: member.name || "Participant",
        recipientEmail: member.email && !member.email.includes("placeholder") ? member.email : null,
        type: certType,
        verificationCode: generateVerificationCode(),
        generatedAt: new Date(),
      });
    }

    // If team has no members recorded, still generate one cert
    if (members.length === 0) {
      records.push({
        id: crypto.randomUUID(),
        eventId,
        teamId: team.id,
        recipientName: team.name,
        recipientEmail: team.leaderEmail || null,
        type: certType,
        verificationCode: generateVerificationCode(),
        generatedAt: new Date(),
      });
    }
  }

  // Delete existing, re-insert
  await db.delete(certificates).where(eq(certificates.eventId, eventId));

  if (records.length > 0) {
    await db.insert(certificates).values(records);
  }

  return {
    total: records.length,
    winners: records.filter((r) => r.type === "WINNER").length,
    runnerUp: records.filter((r) => r.type === "RUNNER_UP").length,
    finalists: records.filter((r) => r.type === "FINALIST").length,
    participants: records.filter((r) => r.type === "PARTICIPANT").length,
  };
}

/**
 * Get all certificates for an event with team details.
 */
export async function getEventCertificates(eventId: string) {
  return db
    .select({
      id: certificates.id,
      eventId: certificates.eventId,
      teamId: certificates.teamId,
      teamName: teams.name,
      recipientName: certificates.recipientName,
      recipientEmail: certificates.recipientEmail,
      type: certificates.type,
      verificationCode: certificates.verificationCode,
      templateId: certificates.templateId,
      fileKey: certificates.fileKey,
      generatedAt: certificates.generatedAt,
      downloadedAt: certificates.downloadedAt,
      createdAt: certificates.createdAt,
    })
    .from(certificates)
    .leftJoin(teams, eq(certificates.teamId, teams.id))
    .where(eq(certificates.eventId, eventId))
    .orderBy(certificates.type, certificates.recipientName);
}

/**
 * Get certificate(s) for a specific team with team details.
 */
export async function getTeamCertificates(teamId: string, eventId: string) {
  return db
    .select({
      id: certificates.id,
      eventId: certificates.eventId,
      teamId: certificates.teamId,
      teamName: teams.name,
      recipientName: certificates.recipientName,
      recipientEmail: certificates.recipientEmail,
      type: certificates.type,
      verificationCode: certificates.verificationCode,
      templateId: certificates.templateId,
      fileKey: certificates.fileKey,
      generatedAt: certificates.generatedAt,
      downloadedAt: certificates.downloadedAt,
      createdAt: certificates.createdAt,
    })
    .from(certificates)
    .leftJoin(teams, eq(certificates.teamId, teams.id))
    .where(and(eq(certificates.teamId, teamId), eq(certificates.eventId, eventId)));
}

/**
 * Mark a certificate as downloaded.
 */
export async function markCertificateDownloaded(certificateId: string) {
  await db
    .update(certificates)
    .set({ downloadedAt: new Date() })
    .where(eq(certificates.id, certificateId));
}

/**
 * Get a certificate by verification code.
 */
export async function getCertificateByCode(code: string) {
  return db.query.certificates.findFirst({
    where: eq(certificates.verificationCode, code),
  });
}
