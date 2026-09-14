import { db } from "@/lib/db";
import { helpRequests, helpRequestMessages, teams, users } from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface CreateHelpRequestInput {
  eventId: string;
  teamId: string;
  participantId: string;
  category:
    | "TECHNICAL_ISSUE"
    | "VENUE_ISSUE"
    | "REGISTRATION_ISSUE"
    | "TEAM_ISSUE"
    | "FOOD_FACILITIES"
    | "MENTOR_STAFF"
    | "JUDGE_RELATED"
    | "SUBMISSION_ISSUE"
    | "OTHER";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  description: string;
  location?: string;
}

export interface UpdateHelpRequestInput {
  status?: "SUBMITTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedStaffId?: string | null;
  resolutionNotes?: string | null;
}

/**
 * Participant creates a new support ticket
 */
export async function createHelpRequest(input: CreateHelpRequestInput) {
  const id = crypto.randomUUID();
  await db.insert(helpRequests).values({
    id,
    eventId: input.eventId,
    teamId: input.teamId,
    participantId: input.participantId,
    category: input.category,
    priority: input.priority || "NORMAL",
    description: input.description,
    location: input.location || null,
    status: "SUBMITTED",
  });

  return getHelpRequestById(id);
}

/**
 * Get help request by ID with relations
 */
export async function getHelpRequestById(requestId: string) {
  const request = await db.query.helpRequests.findFirst({
    where: eq(helpRequests.id, requestId),
  });

  if (!request) return null;

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, request.teamId),
  });

  const participant = await db.query.users.findFirst({
    where: eq(users.id, request.participantId),
  });

  let assignedStaff = null;
  if (request.assignedStaffId) {
    assignedStaff = await db.query.users.findFirst({
      where: eq(users.id, request.assignedStaffId),
    });
  }

  return {
    ...request,
    team: team ? { id: team.id, name: team.name } : null,
    participant: participant
      ? { id: participant.id, name: participant.name, email: participant.email }
      : null,
    assignedStaff: assignedStaff
      ? { id: assignedStaff.id, name: assignedStaff.name, email: assignedStaff.email }
      : null,
  };
}

/**
 * Get all help requests for a participant / team in an event
 */
export async function getParticipantHelpRequests(eventId: string, teamId: string) {
  const list = await db.query.helpRequests.findMany({
    where: and(
      eq(helpRequests.eventId, eventId),
      eq(helpRequests.teamId, teamId)
    ),
    orderBy: [desc(helpRequests.createdAt)],
  });

  const staffIds = list
    .map((r) => r.assignedStaffId)
    .filter((id): id is string => Boolean(id));

  let staffMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (staffIds.length > 0) {
    const staffMembers = await db.query.users.findMany({
      where: inArray(users.id, staffIds),
    });
    staffMap = new Map(staffMembers.map((s) => [s.id, { id: s.id, name: s.name, email: s.email }]));
  }

  return list.map((item) => ({
    ...item,
    assignedStaff: item.assignedStaffId ? staffMap.get(item.assignedStaffId) || null : null,
  }));
}

/**
 * Get all help requests for an event (Coordinator / Staff / Organizer view)
 */
export async function getEventHelpRequests(
  eventId: string,
  options?: {
    status?: string;
    priority?: string;
    category?: string;
  }
) {
  const list = await db.query.helpRequests.findMany({
    where: eq(helpRequests.eventId, eventId),
    orderBy: [
      desc(sql`CASE 
        WHEN priority = 'URGENT' THEN 4 
        WHEN priority = 'HIGH' THEN 3 
        WHEN priority = 'NORMAL' THEN 2 
        ELSE 1 END`),
      desc(helpRequests.createdAt),
    ],
  });

  // Filter in-memory if query parameters provided
  let filtered = list;
  if (options?.status && options.status !== "ALL") {
    filtered = filtered.filter((r) => r.status === options.status);
  }
  if (options?.priority && options.priority !== "ALL") {
    filtered = filtered.filter((r) => r.priority === options.priority);
  }
  if (options?.category && options.category !== "ALL") {
    filtered = filtered.filter((r) => r.category === options.category);
  }

  // Fetch teams & staff for enrichment
  const teamIds = Array.from(new Set(filtered.map((r) => r.teamId)));
  const userIds = Array.from(
    new Set([
      ...filtered.map((r) => r.participantId),
      ...filtered.map((r) => r.assignedStaffId).filter((id): id is string => Boolean(id)),
    ])
  );

  let teamMap = new Map<string, { id: string; name: string }>();
  if (teamIds.length > 0) {
    const teamRows = await db.query.teams.findMany({
      where: inArray(teams.id, teamIds),
    });
    teamMap = new Map(teamRows.map((t) => [t.id, { id: t.id, name: t.name }]));
  }

  let userMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (userIds.length > 0) {
    const userRows = await db.query.users.findMany({
      where: inArray(users.id, userIds),
    });
    userMap = new Map(userRows.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]));
  }

  return filtered.map((req) => ({
    ...req,
    team: teamMap.get(req.teamId) || null,
    participant: userMap.get(req.participantId) || null,
    assignedStaff: req.assignedStaffId ? userMap.get(req.assignedStaffId) || null : null,
  }));
}

/**
 * Staff / Organizer updates status, assigns, or resolves request
 */
export async function updateHelpRequest(
  requestId: string,
  eventId: string,
  updates: UpdateHelpRequestInput
) {
  const current = await db.query.helpRequests.findFirst({
    where: and(eq(helpRequests.id, requestId), eq(helpRequests.eventId, eventId)),
  });

  if (!current) throw new Error("Help request not found");

  const values: Partial<typeof helpRequests.$inferInsert> = {};
  if (updates.status) values.status = updates.status;
  if (updates.priority) values.priority = updates.priority;
  if (updates.assignedStaffId !== undefined) values.assignedStaffId = updates.assignedStaffId;
  if (updates.resolutionNotes !== undefined) values.resolutionNotes = updates.resolutionNotes;
  if (updates.status === "RESOLVED" && current.status !== "RESOLVED") {
    values.resolvedAt = new Date();
  }

  await db
    .update(helpRequests)
    .set(values)
    .where(eq(helpRequests.id, requestId));

  return getHelpRequestById(requestId);
}

/**
 * Add a message / response note to a help request
 */
export async function addHelpRequestMessage(
  requestId: string,
  senderId: string,
  message: string,
  isStaffResponse: boolean
) {
  const id = crypto.randomUUID();
  await db.insert(helpRequestMessages).values({
    id,
    requestId,
    senderId,
    message,
    isStaffResponse: isStaffResponse ? "YES" : "NO",
  });

  return { id, requestId, senderId, message, isStaffResponse, createdAt: new Date() };
}

/**
 * Get ticket statistics for an event
 */
export async function getHelpRequestStats(eventId: string) {
  const list = await db.query.helpRequests.findMany({
    where: eq(helpRequests.eventId, eventId),
  });

  const total = list.length;
  const submitted = list.filter((r) => r.status === "SUBMITTED").length;
  const inProgress = list.filter(
    (r) => r.status === "ASSIGNED" || r.status === "IN_PROGRESS"
  ).length;
  const resolved = list.filter((r) => r.status === "RESOLVED" || r.status === "CLOSED").length;
  const urgent = list.filter((r) => r.priority === "URGENT" && r.status !== "RESOLVED").length;

  return {
    total,
    submitted,
    inProgress,
    resolved,
    urgent,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 100,
  };
}
