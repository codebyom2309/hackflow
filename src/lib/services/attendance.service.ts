import { db } from "@/lib/db";
import { attendanceRecords, teams, users, desks, rooms } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Attendance Service
// ============================================

/**
 * Record attendance check-in for a team.
 */
export async function recordCheckIn(
  eventId: string,
  teamId: string,
  checkedInBy: string,
  method: "QR_SCAN" | "MANUAL" | "JUDGE_SCAN"
) {
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
  });

  if (!team) {
    throw new Error("Team not found in this event");
  }

  // Check if team is already checked in actively
  const activeRecord = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(attendanceRecords.teamId, teamId),
      eq(attendanceRecords.eventId, eventId),
      eq(attendanceRecords.isActive, true)
    ),
  });

  if (activeRecord) {
    return {
      alreadyCheckedIn: true,
      record: activeRecord,
      team,
    };
  }

  const id = crypto.randomUUID();
  await db.insert(attendanceRecords).values({
    id,
    teamId,
    eventId,
    checkedInBy,
    checkInMethod: method,
    isActive: true,
  });

  // Auto-allocate desk on physical check-in if not assigned
  let desk: { deskNumber: number; roomName: string } | null = null;
  if (!team.deskId) {
    const { allocateDesk } = await import("./desk.service");
    const allocated = await allocateDesk(eventId, team.id, team.memberCount);
    if (allocated) {
      desk = {
        deskNumber: allocated.deskNumber,
        roomName: allocated.roomName,
      };
    }
  } else {
    const d = await db.query.desks.findFirst({ where: eq(desks.id, team.deskId) });
    if (d) {
      const r = await db.query.rooms.findFirst({ where: eq(rooms.id, d.roomId) });
      desk = {
        deskNumber: d.deskNumber,
        roomName: r?.name || "Main Hall",
      };
    }
  }

  // Update team status to CHECKED_IN if not already active
  if (team.status === "REGISTERED" || team.status === "WAITLISTED") {
    await db
      .update(teams)
      .set({ status: desk ? "ACTIVE" : "CHECKED_IN" })
      .where(eq(teams.id, teamId));
  }

  return {
    alreadyCheckedIn: false,
    recordId: id,
    team: {
      ...team,
      status: desk ? "ACTIVE" : "CHECKED_IN",
    },
    desk,
  };
}

/**
 * Undo check-in for a team (sets isActive = false, logs undoneBy).
 */
export async function undoCheckIn(
  eventId: string,
  attendanceRecordId: string,
  undoneBy: string
) {
  const record = await db.query.attendanceRecords.findFirst({
    where: and(
      eq(attendanceRecords.id, attendanceRecordId),
      eq(attendanceRecords.eventId, eventId)
    ),
  });

  if (!record) {
    throw new Error("Attendance record not found");
  }

  await db
    .update(attendanceRecords)
    .set({
      isActive: false,
      undoneAt: new Date(),
      undoneBy,
    })
    .where(eq(attendanceRecords.id, attendanceRecordId));

  // Reset team status to REGISTERED if it was CHECKED_IN
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, record.teamId),
  });

  if (team && team.status === "CHECKED_IN") {
    await db
      .update(teams)
      .set({ status: team.deskId ? "ACTIVE" : "REGISTERED" })
      .where(eq(teams.id, team.id));
  }

  return { success: true };
}

/**
 * Get full attendance roster with desk/room info and check-in status.
 */
export async function getAttendanceRoster(eventId: string) {
  const allTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
  });

  const allRecords = await db.query.attendanceRecords.findMany({
    where: and(
      eq(attendanceRecords.eventId, eventId),
      eq(attendanceRecords.isActive, true)
    ),
    orderBy: [desc(attendanceRecords.checkedInAt)],
  });

  const checkedInTeamMap = new Map(allRecords.map((r) => [r.teamId, r]));

  const roster = await Promise.all(
    allTeams.map(async (t) => {
      const activeRecord = checkedInTeamMap.get(t.id);

      let deskInfo = null;
      if (t.deskId) {
        const d = await db.query.desks.findFirst({
          where: eq(desks.id, t.deskId),
        });
        if (d) {
          const r = await db.query.rooms.findFirst({
            where: eq(rooms.id, d.roomId),
          });
          deskInfo = {
            deskNumber: d.deskNumber,
            roomName: r?.name || "Main",
          };
        }
      }

      return {
        teamId: t.id,
        teamName: t.name,
        memberCount: t.memberCount,
        status: t.status,
        isCheckedIn: Boolean(activeRecord),
        attendanceRecordId: activeRecord?.id || null,
        checkedInAt: activeRecord?.checkedInAt || null,
        checkInMethod: activeRecord?.checkInMethod || null,
        desk: deskInfo,
      };
    })
  );

  const total = roster.length;
  const checkedIn = roster.filter((r) => r.isCheckedIn).length;
  const pending = total - checkedIn;

  return {
    roster,
    stats: {
      total,
      checkedIn,
      pending,
      rate: total > 0 ? (checkedIn / total) * 100 : 0,
    },
  };
}
