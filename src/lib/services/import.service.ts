import { db } from "@/lib/db";
import { teams, teamMembers, eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { allocateDesk } from "./desk.service";
import crypto from "crypto";

// ============================================
// Excel/CSV Import Service
// ============================================

interface ImportRow {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone?: string;
  memberCount: number;
  members: { name: string; email?: string; phone?: string }[];
  customData?: Record<string, unknown>;
}

interface ValidationResult {
  row: number;
  valid: boolean;
  errors: string[];
  data: ImportRow | null;
}

/**
 * Parse and validate import data rows.
 */
export function validateImportData(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>,
  minTeamSize: number,
  maxTeamSize: number,
  existingTeamNames: Set<string>,
  existingEmails: Set<string>
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const seenTeamNames = new Set<string>();
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const errors: string[] = [];

    // Map columns
    const teamName = (raw[columnMapping.teamName] || "").trim();
    const leaderName = (raw[columnMapping.leaderName] || "").trim();
    const leaderEmail = (raw[columnMapping.leaderEmail] || "").trim().toLowerCase();
    const leaderPhone = (raw[columnMapping.leaderPhone] || "").trim();
    const memberCountStr = raw[columnMapping.memberCount] || "1";
    const memberCount = parseInt(memberCountStr, 10);

    // Validate required fields
    if (!teamName) errors.push("Team name is required");
    if (!leaderName) errors.push("Leader name is required");
    if (!leaderEmail) errors.push("Leader email is required");
    if (leaderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leaderEmail)) {
      errors.push("Invalid email format");
    }

    // Validate team size
    if (isNaN(memberCount) || memberCount < minTeamSize || memberCount > maxTeamSize) {
      errors.push(`Member count must be between ${minTeamSize} and ${maxTeamSize}`);
    }

    // Check duplicates within file
    if (teamName && seenTeamNames.has(teamName.toLowerCase())) {
      errors.push("Duplicate team name in file");
    }
    if (leaderEmail && seenEmails.has(leaderEmail)) {
      errors.push("Duplicate email in file");
    }

    // Check duplicates against existing data
    if (teamName && existingTeamNames.has(teamName.toLowerCase())) {
      errors.push("Team name already exists in this event");
    }
    if (leaderEmail && existingEmails.has(leaderEmail)) {
      errors.push("Email already registered for this event");
    }

    seenTeamNames.add(teamName.toLowerCase());
    seenEmails.add(leaderEmail);

    if (errors.length === 0) {
      results.push({
        row: i + 1,
        valid: true,
        errors: [],
        data: {
          teamName,
          leaderName,
          leaderEmail,
          leaderPhone: leaderPhone || undefined,
          memberCount: memberCount || 1,
          members: [{ name: leaderName, email: leaderEmail, phone: leaderPhone || undefined }],
        },
      });
    } else {
      results.push({ row: i + 1, valid: false, errors, data: null });
    }
  }

  return results;
}

/**
 * Import validated teams into the database.
 */
export async function importTeams(
  eventId: string,
  validRows: ImportRow[],
  qrSecret: string
): Promise<{ imported: number; failed: number; results: { teamName: string; status: string }[] }> {
  let imported = 0;
  let failed = 0;
  const results: { teamName: string; status: string }[] = [];

  for (const row of validRows) {
    try {
      const teamId = crypto.randomUUID();
      const qrToken = `hf_${crypto
        .createHmac("sha256", qrSecret)
        .update(`${eventId}:${row.teamName}:${Date.now()}`)
        .digest("hex")
        .substring(0, 24)}`;

      // Create team
      await db.insert(teams).values({
        id: teamId,
        eventId,
        name: row.teamName,
        leaderId: "00000000-0000-0000-0000-000000000000", // placeholder for imported teams
        memberCount: row.memberCount,
        qrToken,
        status: "REGISTERED",
      });

      // Create members
      const memberValues = row.members.map((m, idx) => ({
        id: crypto.randomUUID(),
        teamId,
        name: m.name,
        email: m.email || `imported${idx}@placeholder.local`,
        phone: m.phone || undefined,
        isLeader: idx === 0,
      }));

      if (memberValues.length > 0) {
        await db.insert(teamMembers).values(memberValues);
      }

      // Try desk allocation
      const desk = await allocateDesk(eventId, teamId, row.memberCount);

      if (!desk) {
        await db.update(teams).set({ status: "WAITLISTED" }).where(eq(teams.id, teamId));
        results.push({ teamName: row.teamName, status: "WAITLISTED" });
      } else {
        results.push({ teamName: row.teamName, status: "ACTIVE" });
      }

      imported++;
    } catch (error) {
      failed++;
      results.push({ teamName: row.teamName, status: "FAILED" });
    }
  }

  return { imported, failed, results };
}
