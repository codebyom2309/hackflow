import { db, poolConnection } from "@/lib/db";
import { rooms, desks, teams } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type {
  CreateRoomInput,
  UpdateRoomInput,
  BulkCreateDesksInput,
} from "@/lib/validators/venue.validators";
import crypto from "crypto";

// ============================================
// Room Service
// ============================================

export async function createRoom(eventId: string, input: CreateRoomInput) {
  const id = crypto.randomUUID();
  await db.insert(rooms).values({
    id,
    eventId,
    name: input.name,
    roomNumber: input.roomNumber,
  });
  return { id };
}

export async function getEventRooms(eventId: string) {
  const allRooms = await db.query.rooms.findMany({
    where: eq(rooms.eventId, eventId),
  });

  // For each room, get desk stats
  const roomsWithStats = await Promise.all(
    allRooms.map(async (room) => {
      const roomDesks = await db.query.desks.findMany({
        where: eq(desks.roomId, room.id),
      });
      const totalDesks = roomDesks.length;
      const allocatedDesks = roomDesks.filter((d) => d.isAllocated).length;
      const totalCapacity = roomDesks.reduce((sum, d) => sum + d.capacity, 0);

      return {
        ...room,
        totalDesks,
        allocatedDesks,
        availableDesks: totalDesks - allocatedDesks,
        totalCapacity,
      };
    })
  );

  return roomsWithStats;
}

export async function updateRoom(roomId: string, input: UpdateRoomInput) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  if (Object.keys(updateData).length === 0) return;

  await db.update(rooms).set(updateData).where(eq(rooms.id, roomId));
}

export async function deleteRoom(roomId: string) {
  // Check for allocated desks
  const allocatedDesks = await db.query.desks.findMany({
    where: and(eq(desks.roomId, roomId), eq(desks.isAllocated, true)),
  });

  if (allocatedDesks.length > 0) {
    throw new Error(
      `Cannot delete room: ${allocatedDesks.length} desk(s) are still allocated to teams. Release them first.`
    );
  }

  await db.delete(rooms).where(eq(rooms.id, roomId));
}

// ============================================
// Desk Service
// ============================================

export async function getRoomDesks(roomId: string) {
  const allDesks = await db.query.desks.findMany({
    where: eq(desks.roomId, roomId),
  });

  // For allocated desks, get the team info
  const desksWithTeams = await Promise.all(
    allDesks.map(async (desk) => {
      if (desk.isAllocated) {
        const team = await db.query.teams.findFirst({
          where: eq(teams.deskId, desk.id),
        });
        return { ...desk, team: team || null };
      }
      return { ...desk, team: null };
    })
  );

  return desksWithTeams;
}

export async function bulkCreateDesks(
  eventId: string,
  input: BulkCreateDesksInput
) {
  // Verify room belongs to event
  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, input.roomId), eq(rooms.eventId, eventId)),
  });

  if (!room) throw new Error("Room not found in this event");

  const deskValues = [];
  for (let i = 0; i < input.count; i++) {
    deskValues.push({
      id: crypto.randomUUID(),
      roomId: input.roomId,
      deskNumber: input.startNumber + i,
      capacity: input.capacity,
      isAllocated: false,
    });
  }

  // Batch insert
  if (deskValues.length > 0) {
    await db.insert(desks).values(deskValues);
  }

  return { created: deskValues.length };
}

export async function deleteDesk(deskId: string) {
  const desk = await db.query.desks.findFirst({
    where: eq(desks.id, deskId),
  });

  if (!desk) throw new Error("Desk not found");

  if (desk.isAllocated) {
    throw new Error(
      "Cannot delete an allocated desk. Release the team first."
    );
  }

  await db.delete(desks).where(eq(desks.id, deskId));
}

// ============================================
// Desk Allocation (Pessimistic Locking)
// ============================================

/**
 * Allocate a desk for a team using SELECT ... FOR UPDATE.
 * Finds the first available desk with sufficient capacity.
 */
export async function allocateDesk(
  eventId: string,
  teamId: string,
  teamSize: number,
  maxRetries = 3
): Promise<{ deskId: string; roomName: string; deskNumber: number } | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const conn = await poolConnection.getConnection();
    try {
      await conn.beginTransaction();

      // Find available desk with capacity >= teamSize using FOR UPDATE
      const [availableRows] = await conn.execute(
        `SELECT d.id, d.desk_number, d.capacity, r.name as room_name
         FROM desks d
         JOIN rooms r ON d.room_id = r.id
         WHERE r.event_id = ?
           AND d.is_allocated = false
           AND d.capacity >= ?
         ORDER BY d.capacity ASC, d.desk_number ASC
         LIMIT 1
         FOR UPDATE`,
        [eventId, teamSize]
      );

      const rows = availableRows as Array<{
        id: string;
        desk_number: number;
        capacity: number;
        room_name: string;
      }>;

      let desk = rows[0];

      if (!desk) {
        // Fallback: Find largest available desk in event
        const [fallbackRows] = await conn.execute(
          `SELECT d.id, d.desk_number, d.capacity, r.name as room_name
           FROM desks d
           JOIN rooms r ON d.room_id = r.id
           WHERE r.event_id = ?
             AND d.is_allocated = false
           ORDER BY d.capacity DESC, d.desk_number ASC
           LIMIT 1
           FOR UPDATE`,
          [eventId]
        );
        const fRows = fallbackRows as Array<{
          id: string;
          desk_number: number;
          capacity: number;
          room_name: string;
        }>;
        if (fRows.length === 0) {
          await conn.rollback();
          return null; // Truly no desks available
        }
        desk = fRows[0];
      }

      // Mark desk as allocated
      await conn.execute(
        "UPDATE desks SET is_allocated = true WHERE id = ?",
        [desk.id]
      );

      // Assign desk to team and update status
      await conn.execute(
        "UPDATE teams SET desk_id = ?, status = 'ACTIVE' WHERE id = ?",
        [desk.id, teamId]
      );

      await conn.commit();

      return {
        deskId: desk.id,
        roomName: desk.room_name,
        deskNumber: desk.desk_number,
      };
    } catch (error: unknown) {
      await conn.rollback();
      const err = error as { code?: string };
      // Retry on lock timeout
      if (
        err.code === "ER_LOCK_WAIT_TIMEOUT" ||
        err.code === "ER_LOCK_DEADLOCK"
      ) {
        if (attempt < maxRetries - 1) {
          await new Promise((r) =>
            setTimeout(r, 100 * Math.pow(2, attempt))
          );
          continue;
        }
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  return null;
}

/**
 * Release a desk (remove team assignment, mark as available).
 */
export async function releaseDesk(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!team || !team.deskId) {
    throw new Error("Team has no assigned desk");
  }

  // Release desk
  await db
    .update(desks)
    .set({ isAllocated: false })
    .where(eq(desks.id, team.deskId));

  // Remove desk from team
  await db
    .update(teams)
    .set({ deskId: null })
    .where(eq(teams.id, teamId));
}

/**
 * Reassign or assign team to a desk.
 * Allows organizer manual assignment even if capacity is slightly less than team size.
 */
export async function reassignTeam(teamId: string, newDeskId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!team) throw new Error("Team not found");

  const newDesk = await db.query.desks.findFirst({
    where: eq(desks.id, newDeskId),
  });

  if (!newDesk) throw new Error("Desk not found");

  if (newDesk.isAllocated && team.deskId !== newDeskId) {
    throw new Error("Desk is already allocated to another team");
  }

  // Release old desk if exists and different
  if (team.deskId && team.deskId !== newDeskId) {
    await db
      .update(desks)
      .set({ isAllocated: false })
      .where(eq(desks.id, team.deskId));
  }

  // Allocate new desk
  await db
    .update(desks)
    .set({ isAllocated: true })
    .where(eq(desks.id, newDeskId));

  // Update team
  await db
    .update(teams)
    .set({
      deskId: newDeskId,
      status: team.status === "REGISTERED" || team.status === "WAITLISTED" ? "ACTIVE" : team.status,
    })
    .where(eq(teams.id, teamId));
}

/**
 * Auto-allot all unseated teams (REGISTERED, WAITLISTED, ACTIVE) to available desks.
 */
export async function autoAllotRemaining(eventId: string) {
  const { isNull, ne } = await import("drizzle-orm");
  const unseatedTeams = await db.query.teams.findMany({
    where: and(
      eq(teams.eventId, eventId),
      isNull(teams.deskId),
      ne(teams.status, "ELIMINATED")
    ),
  });

  let allocated = 0;
  let failed = 0;

  for (const team of unseatedTeams) {
    const result = await allocateDesk(eventId, team.id, team.memberCount);
    if (result) {
      allocated++;
    } else {
      failed++;
    }
  }

  return { allocated, failed, total: unseatedTeams.length };
}

/**
 * Get venue overview stats for an event.
 */
export async function getVenueStats(eventId: string) {
  const allRooms = await db.query.rooms.findMany({
    where: eq(rooms.eventId, eventId),
  });

  let totalDesks = 0;
  let allocatedDesks = 0;
  let totalCapacity = 0;

  for (const room of allRooms) {
    const roomDesks = await db.query.desks.findMany({
      where: eq(desks.roomId, room.id),
    });
    totalDesks += roomDesks.length;
    allocatedDesks += roomDesks.filter((d) => d.isAllocated).length;
    totalCapacity += roomDesks.reduce((sum, d) => sum + d.capacity, 0);
  }

  return {
    totalRooms: allRooms.length,
    activeRooms: allRooms.filter((r) => r.isActive).length,
    totalDesks,
    allocatedDesks,
    availableDesks: totalDesks - allocatedDesks,
    totalCapacity,
    occupancyRate: totalDesks > 0 ? (allocatedDesks / totalDesks) * 100 : 0,
  };
}
