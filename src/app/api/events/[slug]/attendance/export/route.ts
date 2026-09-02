import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/guards";
import { getEventBySlug } from "@/lib/services/event.service";
import { getAttendanceRoster } from "@/lib/services/attendance.service";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/events/[slug]/attendance/export — Export attendance roster as CSV
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { slug } = await params;
    const event = await getEventBySlug(slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await requireRole(session.user.id, event.id, "ORGANIZER", "COORDINATOR");

    const { roster } = await getAttendanceRoster(event.id);

    // Build CSV
    const headers = [
      "Team ID",
      "Team Name",
      "Members Count",
      "Status",
      "Checked In",
      "Check-in Method",
      "Check-in Timestamp",
      "Room",
      "Desk",
    ];

    const rows = roster.map((r) => [
      `"${r.teamId}"`,
      `"${r.teamName.replace(/"/g, '""')}"`,
      r.memberCount,
      `"${r.status}"`,
      r.isCheckedIn ? "YES" : "NO",
      `"${r.checkInMethod || "N/A"}"`,
      `"${r.checkedInAt ? new Date(r.checkedInAt).toISOString() : "N/A"}"`,
      `"${r.desk?.roomName || "N/A"}"`,
      `"${r.desk ? `D${r.desk.deskNumber}` : "N/A"}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\r\n"
    );

    const safeSlug = event.slug.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${safeSlug}.csv"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/events/[slug]/attendance/export]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
