import { db } from "@/lib/db";
import { certificates, teams, shortlists, teamMembers } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Certificate Service (Level 30)
// ============================================

type CertType = "PARTICIPANT" | "WINNER" | "RUNNER_UP" | "SPECIAL";

/**
 * Generate certificate records for all teams in an event.
 * Type is determined from shortlist rank:
 *   rank 1 → WINNER, rank 2 → RUNNER_UP, else PARTICIPANT.
 */
export async function generateCertificates(eventId: string) {
  // Get all teams
  const allTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });

  // Get all team members (teamMembers stores name/email directly)
  const eventTeamIds = allTeams.map((t) => t.id);
  const eventMembers = eventTeamIds.length > 0
    ? await db
        .select({
          teamId: teamMembers.teamId,
          name: teamMembers.name,
        })
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, eventTeamIds))
    : [];



  // Get latest shortlist for the event (all rounds combined — take highest rank)
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
    if (rank === 1) return "WINNER";
    if (rank === 2) return "RUNNER_UP";
    return "PARTICIPANT";
  }

  const records: Array<{
    id: string;
    eventId: string;
    teamId: string;
    recipientName: string;
    type: CertType;
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
        type: certType,
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
        type: certType,
        generatedAt: new Date(),
      });
    }
  }

  // Upsert: delete existing, re-insert
  await db.delete(certificates).where(eq(certificates.eventId, eventId));

  if (records.length > 0) {
    await db.insert(certificates).values(records);
  }

  return {
    total: records.length,
    winners: records.filter((r) => r.type === "WINNER").length,
    runnerUp: records.filter((r) => r.type === "RUNNER_UP").length,
    participants: records.filter((r) => r.type === "PARTICIPANT").length,
  };
}

/**
 * Get all certificates for an event.
 */
export async function getEventCertificates(eventId: string) {
  return db.query.certificates.findMany({
    where: eq(certificates.eventId, eventId),
    orderBy: (c, { asc }) => [asc(c.type), asc(c.recipientName)],
  });
}

/**
 * Get certificate(s) for a specific participant (by team + event).
 */
export async function getTeamCertificates(teamId: string, eventId: string) {
  return db.query.certificates.findMany({
    where: and(
      eq(certificates.teamId, teamId),
      eq(certificates.eventId, eventId)
    ),
  });
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
