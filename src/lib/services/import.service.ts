import { db } from "@/lib/db";
import { teams, teamMembers, eventMemberships, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { allocateDesk } from "./desk.service";
import crypto from "crypto";

// ============================================
// Excel/CSV Import Service
// ============================================

export interface ImportMember {
  name: string;
  email?: string;
  phone?: string;
  college?: string;
  role?: string;
  portfolio?: string;
  isLeader?: boolean;
}

export interface ImportRow {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone?: string;
  college?: string;
  theme?: string;
  problemStatement?: string;
  memberCount: number;
  members: ImportMember[];
  customData?: Record<string, unknown>;
  formResponses?: Record<string, unknown>;
}

export interface ColumnMapping {
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone?: string;
  college?: string;
  theme?: string;
  problemStatement?: string;
  memberCount?: string;
  leaderDepartment?: string;
  leaderPortfolio?: string;
  utr?: string;
  paymentImage?: string;
  rulesAcknowledged?: string;
  timestamp?: string;
  // Dynamic member columns: member2Name, member2Email, etc.
  [key: string]: string | undefined;
}

interface ValidationResult {
  row: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: ImportRow | null;
}

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  teamsDetected: number;
  participantsDetected: number;
  duplicateTeams: number;
  duplicateEmails: number;
  invalidEmails: number;
  missingFields: number;
  results: ValidationResult[];
}

/**
 * Auto-detect column mapping from header row.
 * Specially tuned for Google Forms / Excel response sheets.
 */
export function autoDetectColumns(
  headers: string[]
): { mapping: Partial<ColumnMapping>; confidence: number } {
  const mapping: Partial<ColumnMapping> = {};
  let matches = 0;
  const total = 3; // minimum required fields

  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // 1. Team name patterns
  const teamIdx = lowerHeaders.findIndex((h) =>
    /team\s*name|group\s*name|squad\s*name|^team$|^group$|project\s*name|startup\s*name|title/i.test(h)
  );
  if (teamIdx >= 0) {
    mapping.teamName = headers[teamIdx];
    matches++;
  } else {
    const fallbackTeam = lowerHeaders.findIndex((h) => /team|group|squad|project/i.test(h));
    if (fallbackTeam >= 0) { mapping.teamName = headers[fallbackTeam]; matches++; }
  }

  // 2. Leader name patterns
  const leaderNameIdx = lowerHeaders.findIndex((h) =>
    /leader\s*(?:full\s*)?name|team\s*leader|captain|full\s*name|your\s*name|student\s*name|participant\s*1\s*name|member\s*1\s*name|^name$|applicant/i.test(h)
  );
  if (leaderNameIdx >= 0) {
    mapping.leaderName = headers[leaderNameIdx];
    matches++;
  } else {
    const fallbackName = lowerHeaders.findIndex((h) => /name/i.test(h) && !/team|group|college|school/i.test(h));
    if (fallbackName >= 0) { mapping.leaderName = headers[fallbackName]; matches++; }
  }

  // 3. Leader email patterns
  const leaderEmailIdx = lowerHeaders.findIndex((h) =>
    /leader\s*(?:email\s*address|email|mail)|team\s*leader\s*email|captain\s*email|email.*leader|leader.*email|email\s*address|primary\s*email|participant\s*1\s*email|member\s*1\s*email|^email$|e-mail/i.test(h)
  );
  if (leaderEmailIdx >= 0) {
    mapping.leaderEmail = headers[leaderEmailIdx];
    matches++;
  } else {
    const emailIdx = lowerHeaders.findIndex((h) => /email|mail/i.test(h));
    if (emailIdx >= 0) { mapping.leaderEmail = headers[emailIdx]; matches++; }
  }

  // 4. Leader phone / WhatsApp
  const phoneIdx = lowerHeaders.findIndex((h) =>
    /leader\s*(?:whatsapp|contact|phone|mobile)|whatsapp|phone\s*number|mobile\s*number|contact\s*number|^phone$|^mobile$|^contact$/i.test(h)
  );
  if (phoneIdx >= 0) { mapping.leaderPhone = headers[phoneIdx]; }

  // 5. College / Institute / Organization
  const collegeIdx = lowerHeaders.findIndex((h) =>
    /leader\s*(?:college|organization|university)|college|institute|university|school|campus|organization|institution/i.test(h)
  );
  if (collegeIdx >= 0) { mapping.college = headers[collegeIdx]; }

  // 6. Leader department / branch / graduation year
  const deptIdx = lowerHeaders.findIndex((h) =>
    /leader\s*(?:department|branch|grad|year)|department|branch|graduation\s*year|degree/i.test(h)
  );
  if (deptIdx >= 0) { mapping.leaderDepartment = headers[deptIdx]; }

  // 7. Leader GitHub / portfolio / LinkedIn
  const portfolioIdx = lowerHeaders.findIndex((h) =>
    /leader\s*(?:github|portfolio|linkedin|profile|link)|github.*link|portfolio.*link|linkedin.*link/i.test(h)
  );
  if (portfolioIdx >= 0) { mapping.leaderPortfolio = headers[portfolioIdx]; }

  // 8. Theme / Track
  const themeIdx = lowerHeaders.findIndex((h) =>
    /chosen\s*theme|theme|track|category|domain|problem\s*area|topic/i.test(h)
  );
  if (themeIdx >= 0) { mapping.theme = headers[themeIdx]; }

  // 9. Problem statement / description
  const psIdx = lowerHeaders.findIndex((h) =>
    /problem\s*statement|problem|project\s*idea|idea|description/i.test(h)
  );
  if (psIdx >= 0) { mapping.problemStatement = headers[psIdx]; }

  // 10. Member count / Team size
  const mcIdx = lowerHeaders.findIndex((h) =>
    /member\s*count|team\s*size|number.*members|total.*members|squad\s*size/i.test(h)
  );
  if (mcIdx >= 0) { mapping.memberCount = headers[mcIdx]; }

  // 11. Payment UTR / Transaction ID
  const utrIdx = lowerHeaders.findIndex((h) =>
    /utr|transaction\s*id|payment\s*id|txn/i.test(h)
  );
  if (utrIdx >= 0) { mapping.utr = headers[utrIdx]; }

  // 12. Payment Screenshot Image URL
  const imgIdx = lowerHeaders.findIndex((h) =>
    /imageid|receipt|payment.*screenshot|proof|screenshot/i.test(h)
  );
  if (imgIdx >= 0) { mapping.paymentImage = headers[imgIdx]; }

  // 13. Code of Conduct Acknowledgment
  const ackIdx = lowerHeaders.findIndex((h) =>
    /rules|code\s*of\s*conduct|terms|agreement|acknowledgment/i.test(h)
  );
  if (ackIdx >= 0) { mapping.rulesAcknowledged = headers[ackIdx]; }

  // 14. Timestamp
  const timeIdx = lowerHeaders.findIndex((h) =>
    /timestamp|submitted\s*at|submission\s*time/i.test(h)
  );
  if (timeIdx >= 0) { mapping.timestamp = headers[timeIdx]; }

  // 15. Dynamic member columns (Member 2 to Member 6)
  for (let i = 2; i <= 6; i++) {
    const mNameIdx = lowerHeaders.findIndex((h) =>
      new RegExp(`member\\s*${i}\\s*(?:full\\s*)?name|m${i}\\s*(?:full\\s*)?name|participant\\s*${i}\\s*(?:full\\s*)?name`, "i").test(h)
    );
    if (mNameIdx >= 0) { mapping[`member${i}Name`] = headers[mNameIdx]; }

    const mEmailIdx = lowerHeaders.findIndex((h) =>
      new RegExp(`member\\s*${i}\\s*(?:email\\s*address|email|mail)|m${i}\\s*(?:email\\s*address|email|mail)|participant\\s*${i}\\s*(?:email\\s*address|email|mail)`, "i").test(h)
    );
    if (mEmailIdx >= 0) { mapping[`member${i}Email`] = headers[mEmailIdx]; }

    const mPhoneIdx = lowerHeaders.findIndex((h) =>
      new RegExp(`member\\s*${i}\\s*(?:whatsapp|contact\\s*number|contact|phone|mobile)|m${i}\\s*(?:whatsapp|contact|phone|mobile)|participant\\s*${i}\\s*(?:whatsapp|contact|phone|mobile)`, "i").test(h)
    );
    if (mPhoneIdx >= 0) { mapping[`member${i}Phone`] = headers[mPhoneIdx]; }

    const mCollegeIdx = lowerHeaders.findIndex((h) =>
      new RegExp(`member\\s*${i}\\s*(?:college|university|institute|school|org)|m${i}\\s*(?:college|university)`, "i").test(h)
    );
    if (mCollegeIdx >= 0) { mapping[`member${i}College`] = headers[mCollegeIdx]; }

    const mRoleIdx = lowerHeaders.findIndex((h) =>
      new RegExp(`member\\s*${i}\\s*(?:role|skill|skillset|domain|primary)|m${i}\\s*(?:role|skill)`, "i").test(h)
    );
    if (mRoleIdx >= 0) { mapping[`member${i}Role`] = headers[mRoleIdx]; }

    const mPortIdx = lowerHeaders.findIndex((h) =>
      new RegExp(`member\\s*${i}\\s*(?:github|linkedin|portfolio|profile|link)|m${i}\\s*(?:github|link)`, "i").test(h)
    );
    if (mPortIdx >= 0) { mapping[`member${i}Portfolio`] = headers[mPortIdx]; }
  }

  // Fallback: If teamName is still not found, fallback to leaderName
  if (!mapping.teamName && mapping.leaderName) {
    mapping.teamName = mapping.leaderName;
  }

  return { mapping, confidence: Math.min(100, Math.round((matches / total) * 100)) };
}

/**
 * Parse and validate import data rows.
 */
export function validateImportData(
  rows: Record<string, string>[],
  columnMapping: ColumnMapping,
  minTeamSize: number,
  maxTeamSize: number,
  existingTeamNames: Set<string>,
  existingEmails: Set<string>
): ImportValidationSummary {
  const results: ValidationResult[] = [];
  const seenTeamNames = new Set<string>();
  const seenEmails = new Set<string>();
  let duplicateTeams = 0;
  let duplicateEmails = 0;
  let invalidEmails = 0;
  let missingFields = 0;
  let totalParticipants = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Map leader & team columns
    const teamName = (raw[columnMapping.teamName] || "").trim();
    const leaderName = (raw[columnMapping.leaderName] || "").trim();
    const leaderEmail = (raw[columnMapping.leaderEmail] || "").trim().toLowerCase();
    const leaderPhone = columnMapping.leaderPhone ? (raw[columnMapping.leaderPhone] || "").trim() : "";
    const college = columnMapping.college ? (raw[columnMapping.college] || "").trim() : "";
    const leaderDept = columnMapping.leaderDepartment ? (raw[columnMapping.leaderDepartment] || "").trim() : "";
    const leaderPortfolio = columnMapping.leaderPortfolio ? (raw[columnMapping.leaderPortfolio] || "").trim() : "";
    const theme = columnMapping.theme ? (raw[columnMapping.theme] || "").trim() : "";
    const problemStatement = columnMapping.problemStatement ? (raw[columnMapping.problemStatement] || "").trim() : "";
    const utr = columnMapping.utr ? (raw[columnMapping.utr] || "").trim() : "";
    const paymentImage = columnMapping.paymentImage ? (raw[columnMapping.paymentImage] || "").trim() : "";
    const rulesAck = columnMapping.rulesAcknowledged ? (raw[columnMapping.rulesAcknowledged] || "").trim() : "";
    const timestamp = columnMapping.timestamp ? (raw[columnMapping.timestamp] || "").trim() : "";

    // Parse members (Leader is always member 1)
    const members: ImportMember[] = [
      {
        name: leaderName || "Team Leader",
        email: leaderEmail,
        phone: leaderPhone || undefined,
        college: college || undefined,
        role: "Team Leader",
        portfolio: leaderPortfolio || undefined,
        isLeader: true,
      },
    ];

    for (let m = 2; m <= 6; m++) {
      const mNameKey = columnMapping[`member${m}Name`];
      const mEmailKey = columnMapping[`member${m}Email`];
      const mPhoneKey = columnMapping[`member${m}Phone`];
      const mCollegeKey = columnMapping[`member${m}College`];
      const mRoleKey = columnMapping[`member${m}Role`];
      const mPortKey = columnMapping[`member${m}Portfolio`];

      const mName = mNameKey ? (raw[mNameKey] || "").trim() : "";
      const mEmail = mEmailKey ? (raw[mEmailKey] || "").trim().toLowerCase() : "";
      const mPhone = mPhoneKey ? (raw[mPhoneKey] || "").trim() : "";
      const mCollege = mCollegeKey ? (raw[mCollegeKey] || "").trim() : "";
      const mRole = mRoleKey ? (raw[mRoleKey] || "").trim() : "";
      const mPort = mPortKey ? (raw[mPortKey] || "").trim() : "";

      if (mName) {
        members.push({
          name: mName,
          email: mEmail || undefined,
          phone: mPhone || undefined,
          college: mCollege || college || undefined,
          role: mRole || undefined,
          portfolio: mPort || undefined,
          isLeader: false,
        });
      }
    }

    // Member count: parse string (e.g. "5 Members" -> 5)
    const memberCountStr = columnMapping.memberCount ? raw[columnMapping.memberCount] : "";
    let parsedCount = parseInt(memberCountStr, 10);
    if (isNaN(parsedCount) || parsedCount < 1) {
      parsedCount = members.length;
    }
    const memberCount = Math.max(parsedCount, members.length);

    // Build structured form responses for rich display
    const formResponses: Record<string, unknown> = {
      timestamp: timestamp || new Date().toISOString(),
      teamSize: memberCountStr || `${memberCount} Members`,
      chosenTheme: theme || null,
      utr: utr || null,
      paymentScreenshot: paymentImage || null,
      rulesAcknowledged: Boolean(rulesAck),
      leader: {
        name: leaderName,
        email: leaderEmail,
        phone: leaderPhone,
        college,
        departmentYear: leaderDept,
        portfolio: leaderPortfolio,
      },
      members: members.map((m, idx) => ({
        index: idx + 1,
        name: m.name,
        email: m.email,
        phone: m.phone,
        college: m.college || college,
        role: m.role || (idx === 0 ? "Team Leader" : "Member"),
        portfolio: m.portfolio,
        isLeader: Boolean(m.isLeader),
      })),
      raw,
    };

    // Validate required fields
    if (!teamName) { errors.push("Team name is required"); missingFields++; }
    if (!leaderName) { errors.push("Leader name is required"); missingFields++; }
    if (!leaderEmail) { errors.push("Leader email is required"); missingFields++; }
    if (leaderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leaderEmail)) {
      errors.push("Invalid leader email format");
      invalidEmails++;
    }

    // Validate member emails
    for (const member of members.slice(1)) {
      if (member.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
        warnings.push(`Invalid email format for member "${member.name}"`);
      }
    }

    // Check duplicates within file
    if (teamName && seenTeamNames.has(teamName.toLowerCase())) {
      errors.push("Duplicate team name in file");
      duplicateTeams++;
    }
    if (leaderEmail && seenEmails.has(leaderEmail)) {
      warnings.push(`Leader email "${leaderEmail}" appears in multiple teams in this file`);
      duplicateEmails++;
    }

    // Check against existing database records
    if (teamName && existingTeamNames.has(teamName.toLowerCase())) {
      warnings.push(`Team "${teamName}" already exists in database`);
    }
    if (leaderEmail && existingEmails.has(leaderEmail)) {
      warnings.push(`Leader email "${leaderEmail}" is already registered`);
    }

    if (teamName) seenTeamNames.add(teamName.toLowerCase());
    if (leaderEmail) seenEmails.add(leaderEmail);

    const valid = errors.length === 0;
    if (valid) {
      totalParticipants += members.length;
    }

    results.push({
      row: i + 1,
      valid,
      errors,
      warnings,
      data: valid
        ? {
            teamName,
            leaderName,
            leaderEmail,
            leaderPhone,
            college,
            theme,
            problemStatement,
            memberCount,
            members,
            formResponses,
          }
        : null,
    });
  }

  const validRows = results.filter((r) => r.valid).length;
  const invalidRows = results.filter((r) => !r.valid).length;

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    teamsDetected: validRows,
    participantsDetected: totalParticipants,
    duplicateTeams,
    duplicateEmails,
    invalidEmails,
    missingFields,
    results,
  };
}

/**
 * Import validated teams into the database.
 * NOTE: Teams are imported with status 'REGISTERED' and deskId null.
 * Desks are allocated on-site during check-in or via explicit venue management.
 */
export async function importTeams(
  eventId: string,
  validRows: ImportRow[],
  qrSecret: string
): Promise<{ imported: number; failed: number; results: { teamName: string; status: string; error?: string }[] }> {
  let imported = 0;
  let failed = 0;
  const results: { teamName: string; status: string; error?: string }[] = [];

  for (const row of validRows) {
    try {
      const teamId = crypto.randomUUID();
      const secretKey = (typeof qrSecret === "string" && qrSecret) ? qrSecret : "hackflow-fallback-qr-secret-key-32ch";
      const qrToken = `hf_${crypto
        .createHmac("sha256", secretKey)
        .update(`${eventId}:${row.teamName}:${Date.now()}:${crypto.randomUUID()}`)
        .digest("hex")
        .substring(0, 24)}`;

      // Resolve or create user for the team leader
      const normalizedLeaderEmail = (row.leaderEmail || `leader_${crypto.randomUUID().slice(0, 8)}@hackflow.local`).trim().toLowerCase();
      let leaderUserId: string | null = null;

      try {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, normalizedLeaderEmail),
        });
        if (existingUser) {
          leaderUserId = existingUser.id;
        } else {
          const newUserId = crypto.randomUUID();
          await db.insert(users).values({
            id: newUserId,
            name: row.leaderName || "Team Leader",
            email: normalizedLeaderEmail,
          });
          leaderUserId = newUserId;
        }
      } catch {
        const placeholderId = crypto.randomUUID();
        await db.insert(users).values({
          id: placeholderId,
          name: row.leaderName || "Team Leader",
          email: `unclaimed_${placeholderId.slice(0, 8)}@hackflow.local`,
        });
        leaderUserId = placeholderId;
      }

      const calculatedMemberCount = row.memberCount && row.memberCount > 0
        ? row.memberCount
        : (row.members && row.members.length > 0 ? row.members.length : 1);

      // Create team — initially in REGISTERED status with NO desk pre-allocation
      await db.insert(teams).values({
        id: teamId,
        eventId,
        name: row.teamName,
        leaderId: leaderUserId,
        memberCount: calculatedMemberCount,
        qrToken,
        status: "REGISTERED",
        deskId: null,
        leaderEmail: normalizedLeaderEmail,
        leaderPhone: row.leaderPhone || null,
        college: row.college || null,
        theme: row.theme || null,
        problemStatement: row.problemStatement || null,
        formResponses: row.formResponses || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create members with intra-team email deduplication (prevents uq_member_email_team conflict)
      const seenMemberEmails = new Set<string>();
      const memberValues = row.members.map((m, idx) => {
        let memberEmail = (m.email || "").trim().toLowerCase();
        if (!memberEmail) {
          memberEmail = `member_${idx + 1}_${teamId.slice(0, 8)}@hackflow.local`;
        }
        if (seenMemberEmails.has(memberEmail)) {
          const [userPart, domainPart] = memberEmail.split("@");
          memberEmail = `${userPart}+m${idx + 1}@${domainPart || "hackflow.local"}`;
        }
        seenMemberEmails.add(memberEmail);

        return {
          id: crypto.randomUUID(),
          teamId,
          name: m.name || (idx === 0 ? "Team Leader" : `Member ${idx + 1}`),
          email: memberEmail,
          phone: m.phone || null,
          isLeader: Boolean(m.isLeader ?? idx === 0),
        };
      });

      if (memberValues.length > 0) {
        await db.insert(teamMembers).values(memberValues);
      }

      // Create participant event membership for the leader
      if (leaderUserId) {
        try {
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
        } catch {
          // ignore duplicate
        }
      }

      // Successful import in REGISTERED status
      results.push({ teamName: row.teamName, status: "REGISTERED" });
      imported++;
    } catch (error) {
      failed++;
      const msg = error instanceof Error ? error.message : "Unknown error";
      results.push({ teamName: row.teamName, status: "FAILED", error: msg });
    }
  }

  return { imported, failed, results };
}

/**
 * Parse an Excel file buffer into row objects.
 */
export function parseExcelBuffer(buffer: Buffer): {
  headers: string[];
  rows: Record<string, string>[];
  sheetName: string;
} {
  // Dynamic import to keep xlsx out of client bundles
  const XLSX = require("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw JSON rows with header
  const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  return { headers, rows: rawRows, sheetName };
}

/**
 * Parse a CSV string into row objects.
 */
export function parseCSVString(csvContent: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // Simple CSV parser (handles quoted fields)
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}
