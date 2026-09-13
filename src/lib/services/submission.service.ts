import { db } from "@/lib/db";
import { submissions, rounds, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// ============================================
// Submission Service
// ============================================

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

interface SubmitInput {
  projectTitle?: string;
  projectDescription?: string;
  githubUrl?: string;
  pptUrl?: string;
  demoUrl?: string;
  problemStatementId?: string;
  pptFileKey?: string;
  pptFilename?: string;
  pptFileSize?: number;
}

/**
 * Create or update a submission for a team in a round.
 */
export async function submitProject(
  eventId: string,
  roundId: string,
  teamId: string,
  input: SubmitInput
) {
  // 1. Validate round exists and is in SUBMISSION_OPEN status
  const round = await db.query.rounds.findFirst({
    where: and(eq(rounds.id, roundId), eq(rounds.eventId, eventId)),
  });

  if (!round) throw new Error("Round not found");

  if (round.status !== "SUBMISSION_OPEN") {
    throw new Error(
      round.status === "DRAFT"
        ? "Submissions are not yet open for this round"
        : "Submissions are locked for this round"
    );
  }

  // 2. Check deadline
  if (round.submissionDeadline && new Date() > new Date(round.submissionDeadline)) {
    throw new Error("Submission deadline has passed");
  }

  // 3. Validate team
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
  });
  if (!team) throw new Error("Team not found in this event");

  // 4. Clean URLs
  const cleanGithub = input.githubUrl ? input.githubUrl.trim() : undefined;
  const cleanPpt = input.pptUrl ? input.pptUrl.trim() : undefined;
  const cleanDemo = input.demoUrl ? input.demoUrl.trim() : undefined;

  // 5. Check for existing submission (upsert logic)
  const existing = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.teamId, teamId),
      eq(submissions.roundId, roundId)
    ),
  });

  let submissionId: string;
  let isUpdate = false;

  if (existing) {
    if (existing.isLocked) {
      throw new Error("This submission is locked and cannot be modified");
    }

    // Update existing submission
    await db
      .update(submissions)
      .set({
        projectTitle: input.projectTitle ?? existing.projectTitle,
        projectDescription: input.projectDescription ?? existing.projectDescription,
        githubUrl: cleanGithub ?? existing.githubUrl,
        pptUrl: cleanPpt ?? existing.pptUrl,
        demoUrl: cleanDemo ?? existing.demoUrl,
        pptFileKey: input.pptFileKey ?? existing.pptFileKey,
        pptFilename: input.pptFilename ?? existing.pptFilename,
        pptFileSize: input.pptFileSize ?? existing.pptFileSize,
        problemStatementId: input.problemStatementId ?? existing.problemStatementId,
        submittedAt: new Date(),
      })
      .where(eq(submissions.id, existing.id));

    submissionId = existing.id;
    isUpdate = true;
  } else {
    // Create new submission
    submissionId = crypto.randomUUID();
    await db.insert(submissions).values({
      id: submissionId,
      teamId,
      roundId,
      eventId,
      projectTitle: input.projectTitle || null,
      projectDescription: input.projectDescription || null,
      githubUrl: cleanGithub || null,
      pptUrl: cleanPpt || null,
      demoUrl: cleanDemo || null,
      pptFileKey: input.pptFileKey || null,
      pptFilename: input.pptFilename || null,
      pptFileSize: input.pptFileSize || null,
      problemStatementId: input.problemStatementId || null,
      isLocked: false,
      submittedAt: new Date(),
    });
  }

  // Also sync to master teams record so idea and links persist globally
  await db
    .update(teams)
    .set({
      ...(input.projectTitle ? { projectName: input.projectTitle } : {}),
      ...(input.projectDescription ? { projectDescription: input.projectDescription } : {}),
      ...(cleanGithub ? { githubUrl: cleanGithub } : {}),
      ...(cleanPpt ? { pptUrl: cleanPpt } : {}),
      ...(cleanDemo ? { demoUrl: cleanDemo } : {}),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  return { id: submissionId, updated: isUpdate };
}

/**
 * Get a team's submission for a specific round.
 */
export async function getTeamSubmission(teamId: string, roundId: string) {
  return db.query.submissions.findFirst({
    where: and(
      eq(submissions.teamId, teamId),
      eq(submissions.roundId, roundId)
    ),
  });
}

/**
 * Get all submissions for a round.
 */
export async function getRoundSubmissions(roundId: string) {
  return db.query.submissions.findMany({
    where: eq(submissions.roundId, roundId),
  });
}

/**
 * Lock all submissions for a round (called when round moves to SUBMISSION_LOCKED).
 */
export async function lockRoundSubmissions(roundId: string) {
  await db
    .update(submissions)
    .set({ isLocked: true })
    .where(eq(submissions.roundId, roundId));
}

/**
 * Validate file type from MIME string.
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_FILE_TYPES.includes(mimeType);
}

export { MAX_FILE_SIZE, ALLOWED_FILE_TYPES };
