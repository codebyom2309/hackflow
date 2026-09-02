import { z } from "zod";

// Room validators
export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100).trim(),
  roomNumber: z.number().int().min(1),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  isActive: z.boolean().optional(),
});

// Desk validators
export const createDeskSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  deskNumber: z.number().int().min(1),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(20),
});

export const bulkCreateDesksSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  count: z.number().int().min(1, "Must create at least 1 desk").max(200, "Maximum 200 desks at once"),
  capacity: z.number().int().min(1).max(20).default(4),
  startNumber: z.number().int().min(1).default(1),
});

export const reassignDeskSchema = z.object({
  teamId: z.string().uuid(),
  newDeskId: z.string().uuid(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateDeskInput = z.infer<typeof createDeskSchema>;
export type BulkCreateDesksInput = z.infer<typeof bulkCreateDesksSchema>;
export type ReassignDeskInput = z.infer<typeof reassignDeskSchema>;
