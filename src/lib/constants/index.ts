// ============================================
// HackFlow — Role Constants & Permission Matrix
// ============================================

export const ROLES = {
  ORGANIZER: "ORGANIZER",
  COORDINATOR: "COORDINATOR",
  JUDGE: "JUDGE",
  PARTICIPANT: "PARTICIPANT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Valid state transitions for events
export const EVENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REGISTRATION_OPEN"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "EVENT_READY"],
  REGISTRATION_CLOSED: ["REGISTRATION_OPEN", "EVENT_READY"],
  EVENT_READY: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ROUND_ACTIVE"],
  ROUND_ACTIVE: ["ROUND_ACTIVE", "EVENT_COMPLETED"],
  EVENT_COMPLETED: ["ROUND_ACTIVE"],
};

// Valid state transitions for rounds
export const ROUND_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMISSION_OPEN"],
  SUBMISSION_OPEN: ["SUBMISSION_LOCKED"],
  SUBMISSION_LOCKED: ["JUDGING"],
  JUDGING: ["RESULTS_PENDING"],
  RESULTS_PENDING: ["RESULTS_PUBLISHED"],
  RESULTS_PUBLISHED: [],
};

// Team statuses
export const TEAM_STATUSES = [
  "REGISTERED",
  "WAITLISTED",
  "CHECKED_IN",
  "ACTIVE",
  "SHORTLISTED",
  "ELIMINATED",
  "FINALIST",
  "WINNER",
] as const;

// File upload limits
export const FILE_LIMITS = {
  PPT_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  XLSX_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  PPT_ALLOWED_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ],
  XLSX_ALLOWED_TYPES: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
} as const;

// QR token prefix
export const QR_PREFIX = "hackflow" as const;

// Judge undo window (milliseconds)
export const JUDGE_UNDO_WINDOW_MS = 10_000; // 10 seconds
