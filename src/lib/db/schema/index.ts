// ============================================
// HackFlow — Schema Barrel Export
// All tables exported from one place
// ============================================

// Auth (NextAuth adapter tables)
export { users } from "./users";
export { accounts, sessions, verificationTokens } from "./auth";

// Core
export { events } from "./events";
export { eventMemberships } from "./event-memberships";
export { roleInvitations } from "./role-invitations";
export { rounds } from "./rounds";
export { rooms, desks } from "./venue";
export { teams, teamMembers } from "./teams";
export { attendanceRecords } from "./attendance";
export {
  evaluationCriteria,
  judgmentScores,
  judgmentCorrections,
} from "./judging";
export { judgeAssignments } from "./judge-assignments";
export { submissions } from "./submissions";
export { shortlists } from "./shortlists";
export { certificates } from "./certificates";
export { certificateTemplates } from "./certificate-templates";
export { announcements } from "./announcements";
export { auditLogs } from "./audit-logs";
