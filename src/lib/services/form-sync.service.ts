import { db } from "@/lib/db";
import { events, teams, teamMembers, users, eventMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { autoDetectColumns, validateImportData, ImportRow } from "./import.service";
import crypto from "crypto";
import * as XLSX from "xlsx";

export interface SyncStats {
  totalRows: number;
  validRows: number;
  newTeams: number;
  updatedTeams: number;
  failedTeams: number;
  lastSyncedAt: string;
  errors: string[];
}

/**
 * Normalizes a Google Sheet URL to its direct CSV export URL
 */
export function normalizeGoogleSheetUrl(url: string): string {
  const trimmed = url.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    const sheetId = match[1];
    // Check if a specific gid exists
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
    const gidParam = gidMatch && gidMatch[1] ? `&gid=${gidMatch[1]}` : "";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
  }
  return trimmed;
}

/**
 * Synchronize an event with a Google Sheet CSV URL or direct CSV text
 */
export async function syncEventGoogleSheet(
  eventId: string,
  rawSheetUrl?: string,
  directCsvContent?: string
): Promise<SyncStats> {
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const targetUrl = rawSheetUrl || event.googleSheetUrl;
  let csvText = directCsvContent || "";

  if (!csvText) {
    if (!targetUrl) {
      throw new Error("No Google Sheet URL configured for this event.");
    }

    const fetchUrl = normalizeGoogleSheetUrl(targetUrl);
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "HackFlow-Sync-Engine/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Google Sheet (${response.status} ${response.statusText}). ` +
        "Ensure the Google Sheet is shared as 'Anyone with the link can view'."
      );
    }

    csvText = await response.text();
  }

  if (!csvText.trim()) {
    throw new Error("Google Sheet returned empty content.");
  }

  // Parse CSV using xlsx
  const workbook = XLSX.read(csvText, { type: "string" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error("No data rows found in Google Sheet.");
  }

  const headers = Object.keys(rows[0] || {});
  const { mapping } = autoDetectColumns(headers);

  // Fetch existing teams for this event
  const existingDbTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });

  const existingTeamMap = new Map<string, (typeof existingDbTeams)[0]>();
  const existingEmailMap = new Map<string, (typeof existingDbTeams)[0]>();

  for (const t of existingDbTeams) {
    existingTeamMap.set(t.name.toLowerCase().trim(), t);
    if (t.leaderEmail) {
      existingEmailMap.set(t.leaderEmail.toLowerCase().trim(), t);
    }
  }

  // Validate rows
  const validationSummary = validateImportData(
    rows,
    mapping as any,
    event.minTeamSize || 1,
    event.maxTeamSize || 10,
    new Set(existingTeamMap.keys()),
    new Set(existingEmailMap.keys())
  );

  let newTeams = 0;
  let updatedTeams = 0;
  let failedTeams = 0;
  const errors: string[] = [];

  for (const result of validationSummary.results) {
    if (!result.valid || !result.data) {
      if (result.errors.length > 0) {
        errors.push(`Row ${result.row}: ${result.errors.join(", ")}`);
      }
      failedTeams++;
      continue;
    }

    const row = result.data;
    const normTeamName = row.teamName.toLowerCase().trim();
    const normLeaderEmail = row.leaderEmail.toLowerCase().trim();

    // Check if team already exists by unique team name
    const existing = existingTeamMap.get(normTeamName);

    try {
      if (existing) {
        // UPDATE existing team data without altering desk allocation or status
        await db
          .update(teams)
          .set({
            memberCount: Math.max(row.memberCount, row.members.length),
            leaderPhone: row.leaderPhone || existing.leaderPhone,
            college: row.college || existing.college,
            theme: row.theme || existing.theme,
            problemStatement: row.problemStatement || existing.problemStatement,
            formResponses: row.formResponses,
            updatedAt: new Date(),
          })
          .where(eq(teams.id, existing.id));

        // Update/ensure team members
        const seenEmails = new Set<string>();
        for (let idx = 0; idx < row.members.length; idx++) {
          const m = row.members[idx];
          let mEmail = (m.email || "").trim().toLowerCase();
          if (!mEmail) {
            mEmail = `member_${idx + 1}_${existing.id.slice(0, 8)}@hackflow.local`;
          }
          if (seenEmails.has(mEmail)) {
            const [u, d] = mEmail.split("@");
            mEmail = `${u}+m${idx + 1}@${d || "hackflow.local"}`;
          }
          seenEmails.add(mEmail);

          // Check if member exists in team
          const existingMember = await db.query.teamMembers.findFirst({
            where: and(
              eq(teamMembers.teamId, existing.id),
              eq(teamMembers.email, mEmail)
            ),
          });

          if (existingMember) {
            await db
              .update(teamMembers)
              .set({
                name: m.name,
                phone: m.phone || existingMember.phone,
                isLeader: Boolean(m.isLeader ?? idx === 0),
              })
              .where(eq(teamMembers.id, existingMember.id));
          } else {
            await db.insert(teamMembers).values({
              id: crypto.randomUUID(),
              teamId: existing.id,
              name: m.name || (idx === 0 ? "Team Leader" : `Member ${idx + 1}`),
              email: mEmail,
              phone: m.phone || null,
              isLeader: Boolean(m.isLeader ?? idx === 0),
            });
          }
        }

        updatedTeams++;
      } else {
        // INSERT brand new team
        const newTeamId = crypto.randomUUID();
        const secretKey = event.qrSecret || "hackflow-qr-secret-key-32ch";
        const qrToken = `hf_${crypto
          .createHmac("sha256", secretKey)
          .update(`${eventId}:${row.teamName}:${Date.now()}:${crypto.randomUUID()}`)
          .digest("hex")
          .substring(0, 24)}`;

        // Resolve leader user
        let leaderUserId: string;
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, normLeaderEmail),
        });

        if (existingUser) {
          leaderUserId = existingUser.id;
        } else {
          leaderUserId = crypto.randomUUID();
          await db.insert(users).values({
            id: leaderUserId,
            name: row.leaderName || "Team Leader",
            email: normLeaderEmail,
          });
        }

        await db.insert(teams).values({
          id: newTeamId,
          eventId,
          name: row.teamName,
          leaderId: leaderUserId,
          memberCount: Math.max(row.memberCount, row.members.length),
          qrToken,
          status: "REGISTERED",
          deskId: null,
          leaderEmail: normLeaderEmail,
          leaderPhone: row.leaderPhone || null,
          college: row.college || null,
          theme: row.theme || null,
          problemStatement: row.problemStatement || null,
          formResponses: row.formResponses,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Insert members
        const seenEmails = new Set<string>();
        const memberValues = row.members.map((m, idx) => {
          let mEmail = (m.email || "").trim().toLowerCase();
          if (!mEmail) {
            mEmail = `member_${idx + 1}_${newTeamId.slice(0, 8)}@hackflow.local`;
          }
          if (seenEmails.has(mEmail)) {
            const [u, d] = mEmail.split("@");
            mEmail = `${u}+m${idx + 1}@${d || "hackflow.local"}`;
          }
          seenEmails.add(mEmail);

          return {
            id: crypto.randomUUID(),
            teamId: newTeamId,
            name: m.name || (idx === 0 ? "Team Leader" : `Member ${idx + 1}`),
            email: mEmail,
            phone: m.phone || null,
            isLeader: Boolean(m.isLeader ?? idx === 0),
          };
        });

        if (memberValues.length > 0) {
          await db.insert(teamMembers).values(memberValues);
        }

        // Add event membership for leader
        const existingMem = await db.query.eventMemberships.findFirst({
          where: and(
            eq(eventMemberships.userId, leaderUserId),
            eq(eventMemberships.eventId, eventId)
          ),
        });

        if (!existingMem) {
          await db.insert(eventMemberships).values({
            id: crypto.randomUUID(),
            userId: leaderUserId,
            eventId,
            role: "PARTICIPANT",
          });
        }

        existingTeamMap.set(normTeamName, { id: newTeamId } as any);
        existingEmailMap.set(normLeaderEmail, { id: newTeamId } as any);
        newTeams++;
      }
    } catch (err: any) {
      failedTeams++;
      errors.push(`Team "${row.teamName}": ${err.message}`);
    }
  }

  // Persist updated sync state in event
  const now = new Date();
  await db
    .update(events)
    .set({
      lastSyncedAt: now,
      ...(targetUrl ? { googleSheetUrl: targetUrl } : {}),
      updatedAt: now,
    })
    .where(eq(events.id, eventId));

  return {
    totalRows: rows.length,
    validRows: validationSummary.validRows,
    newTeams,
    updatedTeams,
    failedTeams,
    lastSyncedAt: now.toISOString(),
    errors: errors.slice(0, 10),
  };
}
