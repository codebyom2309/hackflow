import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { db } from "@/lib/db";
import { teams, teamMembers, rooms, desks, attendanceRecords, shortlists, certificates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/export?type=teams|participants|venue|results|certificates
 * Export event data as CSV.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user!.id!, event.id, "ORGANIZER");

    const type = req.nextUrl.searchParams.get("type") || "teams";
    let csv = "";
    let filename = "";

    switch (type) {
      case "teams": {
        const allTeams = await db.query.teams.findMany({
          where: eq(teams.eventId, event.id),
        });
        csv = "Team Name,Status,Member Count,Theme,Problem Statement / Idea,Leader Name,Leader Email,Leader Phone,College,Department & Year,Member 2 Name,Member 2 Email,Member 2 Role,Member 3 Name,Member 3 Email,Member 3 Role,Member 4 Name,Member 4 Email,Member 5 Name,Member 5 Email,UTR / Txn ID,Payment Screenshot,Assigned Desk,QR Token\n";
        for (const t of allTeams) {
          let deskInfo = "Unassigned";
          if (t.deskId) {
            const d = await db.query.desks.findFirst({ where: eq(desks.id, t.deskId) });
            if (d) {
              const r = await db.query.rooms.findFirst({ where: eq(rooms.id, d.roomId) });
              deskInfo = `${r?.name || ""} D${d.deskNumber}`;
            }
          }
          const resp: any = t.formResponses || {};
          const leader = resp.leader || {};
          const membersList: any[] = Array.isArray(resp.members) ? resp.members : [];
          const m2 = membersList[1] || {};
          const m3 = membersList[2] || {};
          const m4 = membersList[3] || {};
          const m5 = membersList[4] || {};

          const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

          csv += [
            escapeCsv(t.name),
            escapeCsv(t.status),
            t.memberCount,
            escapeCsv(t.theme || resp.chosenTheme || ""),
            escapeCsv(t.problemStatement || t.projectDescription || ""),
            escapeCsv(leader.name || ""),
            escapeCsv(t.leaderEmail || leader.email || ""),
            escapeCsv(t.leaderPhone || leader.phone || ""),
            escapeCsv(t.college || leader.college || ""),
            escapeCsv(leader.departmentYear || ""),
            escapeCsv(m2.name || ""),
            escapeCsv(m2.email || ""),
            escapeCsv(m2.role || ""),
            escapeCsv(m3.name || ""),
            escapeCsv(m3.email || ""),
            escapeCsv(m3.role || ""),
            escapeCsv(m4.name || ""),
            escapeCsv(m4.email || ""),
            escapeCsv(m5.name || ""),
            escapeCsv(m5.email || ""),
            escapeCsv(resp.utr || ""),
            escapeCsv(resp.paymentScreenshot || ""),
            escapeCsv(deskInfo),
            escapeCsv(t.qrToken),
          ].join(",") + "\n";
        }
        filename = `teams_${slug}.csv`;
        break;
      }

      case "participants": {
        const allTeams2 = await db.query.teams.findMany({
          where: eq(teams.eventId, event.id),
        });
        csv = "Team Name,Member Name,Email,Phone,Role / Skillset,College,Is Leader,Desk\n";
        for (const t of allTeams2) {
          let deskInfo = "Unassigned";
          if (t.deskId) {
            const d = await db.query.desks.findFirst({ where: eq(desks.id, t.deskId) });
            if (d) {
              const r = await db.query.rooms.findFirst({ where: eq(rooms.id, d.roomId) });
              deskInfo = `${r?.name || ""} D${d.deskNumber}`;
            }
          }
          const members = await db.query.teamMembers.findMany({
            where: eq(teamMembers.teamId, t.id),
          });
          for (const m of members) {
            const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
            csv += [
              escapeCsv(t.name),
              escapeCsv(m.name),
              escapeCsv(m.email),
              escapeCsv(m.phone || t.leaderPhone || ""),
              escapeCsv(m.isLeader ? "Team Leader" : "Member"),
              escapeCsv(t.college || ""),
              m.isLeader ? "TRUE" : "FALSE",
              escapeCsv(deskInfo),
            ].join(",") + "\n";
          }
        }
        filename = `participants_${slug}.csv`;
        break;
      }

      case "venue": {
        const allRooms = await db.query.rooms.findMany({
          where: eq(rooms.eventId, event.id),
        });
        csv = "Room Name,Room Number,Desk Number,Capacity,Allocated,Team Name\n";
        for (const r of allRooms) {
          const roomDesks = await db.query.desks.findMany({
            where: eq(desks.roomId, r.id),
          });
          for (const d of roomDesks) {
            let teamName = "";
            if (d.isAllocated) {
              const t = await db.query.teams.findFirst({
                where: eq(teams.deskId, d.id),
              });
              teamName = t?.name || "";
            }
            csv += `"${r.name}",${r.roomNumber},${d.deskNumber},${d.capacity},${d.isAllocated},"${teamName}"\n`;
          }
        }
        filename = `venue_${slug}.csv`;
        break;
      }

      case "results": {
        const allShortlists = await db.query.shortlists.findMany({
          where: eq(shortlists.eventId, event.id),
        });
        csv = "Rank,Team Name,Score,Advancing\n";
        const sorted = allShortlists.sort(
          (a, b) => (a.finalRank ?? a.calculatedRank) - (b.finalRank ?? b.calculatedRank)
        );
        for (const s of sorted) {
          const t = await db.query.teams.findFirst({
            where: eq(teams.id, s.teamId),
          });
          csv += `${s.finalRank ?? s.calculatedRank},"${t?.name || ""}",${s.totalScore},${s.isAdvancing}\n`;
        }
        filename = `results_${slug}.csv`;
        break;
      }

      case "certificates": {
        const allCerts = await db.query.certificates.findMany({
          where: eq(certificates.eventId, event.id),
        });
        csv = "Certificate ID,Recipient,Type,Verification Code,Generated At\n";
        for (const c of allCerts) {
          csv += `"${c.id}","${c.recipientName}","${c.type}","${c.verificationCode}","${c.generatedAt?.toISOString() || ""}"\n`;
        }
        filename = `certificates_${slug}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
  }
}
