import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import {
  parseExcelBuffer,
  parseCSVString,
  autoDetectColumns,
  validateImportData,
  importTeams,
} from "@/lib/services/import.service";
import { db } from "@/lib/db";
import { teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeAuditLog, AuditAction } from "@/lib/services/audit.service";
import type { ColumnMapping } from "@/lib/services/import.service";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/events/[slug]/import
 * Upload and preview or import a file.
 * 
 * Query params:
 *   ?action=preview  — parse file and return validation results (default)
 *   ?action=import   — parse, validate, and import valid rows
 *
 * Body: FormData with:
 *   - file: the .xlsx or .csv file
 *   - columnMapping: (optional) JSON string of column mapping overrides
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const action = req.nextUrl.searchParams.get("action") || "preview";
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let headers: string[];
    let rows: Record<string, string>[];
    let sheetName = "";

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const result = parseExcelBuffer(buffer);
      headers = result.headers;
      rows = result.rows;
      sheetName = result.sheetName;
    } else if (fileName.endsWith(".csv")) {
      const csvText = buffer.toString("utf-8");
      const result = parseCSVString(csvText);
      headers = result.headers;
      rows = result.rows;
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload .xlsx or .csv" },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "File is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Auto-detect or use provided column mapping
    let columnMapping: ColumnMapping;
    const mappingStr = formData.get("columnMapping") as string | null;

    if (mappingStr) {
      columnMapping = JSON.parse(mappingStr);
    } else {
      const detected = autoDetectColumns(headers);
      const m = { ...detected.mapping };

      // Resilient fallbacks
      if (!m.leaderEmail) {
        const emailH = headers.find((h) => /email|mail/i.test(h));
        if (emailH) m.leaderEmail = emailH;
      }
      if (!m.leaderName) {
        const nameH = headers.find((h) => /name/i.test(h) && !/team|group|college|school/i.test(h));
        if (nameH) m.leaderName = nameH;
      }
      if (!m.teamName) {
        const teamH = headers.find((h) => /team|group|project|squad/i.test(h));
        m.teamName = teamH || m.leaderName || headers[0];
      }

      columnMapping = m as ColumnMapping;
    }

    // Get existing data for duplicate detection
    const existingTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, event.id),
    });
    const existingTeamNames = new Set(existingTeams.map((t) => t.name.toLowerCase()));

    const existingMembers: { email: string }[] = [];
    for (const team of existingTeams) {
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, team.id),
      });
      existingMembers.push(...members.map((m) => ({ email: m.email.toLowerCase() })));
    }
    const existingEmails = new Set(existingMembers.map((m) => m.email));

    // Validate
    const validation = validateImportData(
      rows,
      columnMapping,
      event.minTeamSize,
      event.maxTeamSize,
      existingTeamNames,
      existingEmails
    );

    if (action === "preview") {
      return NextResponse.json({
        data: {
          fileName: file.name,
          sheetName,
          headers,
          columnMapping,
          validation: {
            totalRows: validation.totalRows,
            validRows: validation.validRows,
            invalidRows: validation.invalidRows,
            teamsDetected: validation.teamsDetected,
            participantsDetected: validation.participantsDetected,
            duplicateTeams: validation.duplicateTeams,
            duplicateEmails: validation.duplicateEmails,
            invalidEmails: validation.invalidEmails,
            missingFields: validation.missingFields,
          },
          // First 5 valid + all invalid for review
          sampleValid: validation.results.filter((r) => r.valid).slice(0, 5),
          invalidRows: validation.results.filter((r) => !r.valid),
        },
      });
    }

    // Action: import
    if (validation.validRows === 0) {
      return NextResponse.json(
        { error: "No valid rows to import", validation },
        { status: 400 }
      );
    }

    const validData = validation.results
      .filter((r) => r.valid && r.data)
      .map((r) => r.data!);

    const importResult = await importTeams(event.id, validData, event.qrSecret);

    // Audit log
    await writeAuditLog({
      eventId: event.id,
      userId: session.user!.id!,
      action: AuditAction.TEAM_REGISTERED,
      entityType: "import",
      entityId: null,
      details: {
        fileName: file.name,
        imported: importResult.imported,
        failed: importResult.failed,
        source: "file_import",
      },
    });

    return NextResponse.json({
      data: {
        imported: importResult.imported,
        failed: importResult.failed,
        results: importResult.results,
        validation: {
          totalRows: validation.totalRows,
          validRows: validation.validRows,
          invalidRows: validation.invalidRows,
        },
      },
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json(
      { error: err.message || "Import failed" },
      { status: err.statusCode || 500 }
    );
  }
}
