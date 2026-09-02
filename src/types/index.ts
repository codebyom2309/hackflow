// ============================================
// HackFlow — Shared Type Definitions
// ============================================

// --- Roles ---
export type Role = "ORGANIZER" | "COORDINATOR" | "JUDGE" | "PARTICIPANT";

// --- Event Status ---
export type EventStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "EVENT_READY"
  | "ROUND_ACTIVE"
  | "EVENT_COMPLETED";

// --- Round Status ---
export type RoundStatus =
  | "DRAFT"
  | "SUBMISSION_OPEN"
  | "SUBMISSION_LOCKED"
  | "JUDGING"
  | "RESULTS_PENDING"
  | "RESULTS_PUBLISHED";

// --- Team Status ---
export type TeamStatus =
  | "REGISTERED"
  | "WAITLISTED"
  | "CHECKED_IN"
  | "ACTIVE"
  | "SHORTLISTED"
  | "ELIMINATED"
  | "FINALIST"
  | "WINNER";

// --- Registration Method ---
export type RegistrationMethod = "NATIVE" | "EXTERNAL";

// --- Check-in Method ---
export type CheckInMethod = "QR_SCAN" | "MANUAL" | "JUDGE_SCAN";

// --- Certificate Type ---
export type CertificateType = "PARTICIPANT" | "WINNER" | "RUNNER_UP" | "SPECIAL";

// --- Announcement Priority ---
export type AnnouncementPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

// --- Announcement Target ---
export type AnnouncementTarget = "ALL" | "PARTICIPANT" | "COORDINATOR" | "JUDGE";

// --- Invitation Role ---
export type InvitationRole = "COORDINATOR" | "JUDGE";
