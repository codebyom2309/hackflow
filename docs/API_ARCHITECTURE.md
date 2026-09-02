# API Architecture — HackFlow

## Conventions

- All API routes live under `/api/` using Next.js App Router Route Handlers
- Authentication via NextAuth.js session (cookie-based)
- Authorization checked in every route handler via `auth()` + role verification
- Request validation via Zod schemas
- Consistent error response format: `{ error: string, code: string, details?: any }`
- Success response format: `{ data: T, message?: string }`
- All mutating endpoints use POST/PUT/PATCH/DELETE (never GET for mutations)
- Idempotency keys for critical write operations (judgments, submissions)

---

## Route Map

### Authentication

| Method | Route | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | Public | NextAuth.js handler (Google OAuth) |

---

### Events

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events` | ✅ | Any authenticated | Create event (creator becomes ORGANIZER) |
| GET | `/api/events` | ✅ | Any authenticated | List user's events (by membership) |
| GET | `/api/events/[slug]` | ✅ | Event member | Get event details |
| PATCH | `/api/events/[slug]` | ✅ | ORGANIZER | Update event configuration |
| PATCH | `/api/events/[slug]/status` | ✅ | ORGANIZER | Change event state (state machine) |
| GET | `/api/events/[slug]/stats` | ✅ | ORGANIZER | Event statistics dashboard |

---

### Event Invitations

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/invitations` | ✅ | ORGANIZER | Create coordinator/judge invitation |
| GET | `/api/events/[slug]/invitations` | ✅ | ORGANIZER | List all invitations |
| DELETE | `/api/events/[slug]/invitations/[id]` | ✅ | ORGANIZER | Revoke invitation |
| POST | `/api/invitations/accept` | ✅ | Any authenticated | Accept invitation (token in body) |

---

### Rooms & Desks

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/rooms` | ✅ | ORGANIZER | Create room |
| GET | `/api/events/[slug]/rooms` | ✅ | ORGANIZER/COORDINATOR | List rooms with desks |
| PATCH | `/api/events/[slug]/rooms/[roomId]` | ✅ | ORGANIZER | Update room (rename, activate/deactivate) |
| DELETE | `/api/events/[slug]/rooms/[roomId]` | ✅ | ORGANIZER | Delete room (only if no allocated desks) |
| POST | `/api/events/[slug]/rooms/[roomId]/desks` | ✅ | ORGANIZER | Create desk(s) — supports bulk |
| PATCH | `/api/events/[slug]/desks/[deskId]` | ✅ | ORGANIZER | Update desk (capacity, reassign team) |
| DELETE | `/api/events/[slug]/desks/[deskId]` | ✅ | ORGANIZER | Delete desk (only if unallocated) |
| POST | `/api/events/[slug]/desks/auto-allot` | ✅ | ORGANIZER | Auto-allot waitlisted teams |
| POST | `/api/events/[slug]/desks/reassign` | ✅ | ORGANIZER | Manually reassign team to desk |

---

### Teams & Registration

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/register` | ✅ | Any authenticated | Register team (native form) |
| GET | `/api/events/[slug]/teams` | ✅ | ORGANIZER/COORDINATOR/JUDGE | List teams (role-filtered fields) |
| GET | `/api/events/[slug]/teams/[teamId]` | ✅ | ORGANIZER/own team | Get team details |
| GET | `/api/events/[slug]/my-team` | ✅ | PARTICIPANT | Get authenticated user's team |
| PATCH | `/api/events/[slug]/teams/[teamId]` | ✅ | ORGANIZER | Update team (admin override) |
| DELETE | `/api/events/[slug]/teams/[teamId]` | ✅ | ORGANIZER | Remove team (ghost team purge) |
| POST | `/api/events/[slug]/import` | ✅ | ORGANIZER | Import teams from XLSX/CSV |
| GET | `/api/events/[slug]/import/preview` | ✅ | ORGANIZER | Preview import results |

---

### Universal QR Scan

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/scan` | ✅ | COORDINATOR/JUDGE/ORGANIZER | Universal scan endpoint |

**Request body:**
```typescript
{
  qr_payload: string;  // The scanned QR content
}
```

**Response varies by role:**

**COORDINATOR response:**
```typescript
{
  action: 'CHECK_IN',
  team: { id, name, leader_name },
  desk: { room_name, room_number, desk_number },
  already_checked_in: boolean,
  checked_in_at?: string,
  checked_in_by?: string
}
```

**JUDGE response:**
```typescript
{
  action: 'JUDGE',
  team: { id, name, leader_name, member_count },
  desk: { room_name, desk_number },
  round: { id, round_number, title },
  already_judged_by_me: boolean,
  other_judges_count: number,
  criteria: EvaluationCriteria[],
  submission?: { github_url, ppt_filename }
}
```

---

### Attendance

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/attendance/check-in` | ✅ | COORDINATOR/ORGANIZER | Check in team |
| POST | `/api/events/[slug]/attendance/undo` | ✅ | COORDINATOR/ORGANIZER | Undo check-in |
| GET | `/api/events/[slug]/attendance` | ✅ | ORGANIZER | Full attendance feed |
| GET | `/api/events/[slug]/attendance/stats` | ✅ | ORGANIZER | Attendance statistics |

---

### Rounds

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/rounds` | ✅ | ORGANIZER | Create round |
| GET | `/api/events/[slug]/rounds` | ✅ | Event member | List rounds |
| PATCH | `/api/events/[slug]/rounds/[roundId]` | ✅ | ORGANIZER | Update round config |
| PATCH | `/api/events/[slug]/rounds/[roundId]/status` | ✅ | ORGANIZER | Change round status |
| GET | `/api/events/[slug]/rounds/[roundId]/problem` | ✅ | PARTICIPANT | Get problem statement (server-side time check) |

---

### Submissions

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/submissions` | ✅ | PARTICIPANT (leader) | Submit project |
| PATCH | `/api/events/[slug]/submissions/[submissionId]` | ✅ | PARTICIPANT (leader) | Update submission (before lock) |
| GET | `/api/events/[slug]/submissions/[submissionId]` | ✅ | PARTICIPANT (own)/JUDGE/ORGANIZER | View submission |
| POST | `/api/events/[slug]/submissions/upload` | ✅ | PARTICIPANT (leader) | Upload PPT/PDF file |

---

### Judgments

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/judgments` | ✅ | JUDGE | Submit judgment scores |
| GET | `/api/events/[slug]/judgments/matrix` | ✅ | ORGANIZER | Full scoring matrix |
| GET | `/api/events/[slug]/judgments/my-progress` | ✅ | JUDGE | Judge's own progress |
| POST | `/api/events/[slug]/judgments/[judgmentId]/correct` | ✅ | JUDGE (own)/ORGANIZER | Correct a score |
| POST | `/api/events/[slug]/judgments/undo` | ✅ | JUDGE | Undo recent judgment (within window) |

**Judgment submission body:**
```typescript
{
  team_id: string;
  round_id: string;
  idempotency_key: string;
  scores: Array<{
    criteria_id: string;
    score: number;
  }>;
}
```

---

### Shortlisting & Rankings

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/events/[slug]/rankings` | ✅ | ORGANIZER | Calculated rankings for active round |
| POST | `/api/events/[slug]/rankings/override` | ✅ | ORGANIZER | Manual rank override |
| POST | `/api/events/[slug]/shortlist` | ✅ | ORGANIZER | Create shortlist (specify count) |
| GET | `/api/events/[slug]/shortlist` | ✅ | ORGANIZER | View shortlist preview |
| POST | `/api/events/[slug]/shortlist/publish` | ✅ | ORGANIZER | Publish results |
| GET | `/api/events/[slug]/results` | ✅ | Event member | View published results |

---

### Certificates

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/certificates/generate` | ✅ | ORGANIZER | Trigger certificate generation |
| GET | `/api/events/[slug]/certificates` | ✅ | ORGANIZER | List all certificates |
| GET | `/api/events/[slug]/certificates/my` | ✅ | PARTICIPANT | Get own certificate |
| GET | `/api/events/[slug]/certificates/[certId]/download` | ✅ | PARTICIPANT (own)/ORGANIZER | Download certificate PDF |

---

### Announcements

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/events/[slug]/announcements` | ✅ | ORGANIZER | Create announcement |
| GET | `/api/events/[slug]/announcements` | ✅ | Event member | List announcements (role-filtered) |

---

### Real-Time (SSE)

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/events/[slug]/sse` | ✅ | Event member | SSE event stream |

**SSE Events:**
```
event: round:status_changed
data: {"round_id": "...", "status": "SUBMISSION_OPEN", "round_number": 1}

event: announcement:new
data: {"id": "...", "title": "...", "content": "...", "priority": "HIGH"}

event: results:published
data: {"round_id": "...", "round_number": 1}

event: judgment:submitted
data: {"team_id": "...", "judge_id": "...", "round_id": "..."}

event: attendance:updated
data: {"team_id": "...", "team_name": "...", "checked_in": true}
```

---

### QR

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/events/[slug]/my-qr` | ✅ | PARTICIPANT | Get QR token data for rendering |
| GET | `/api/events/[slug]/my-qr/download` | ✅ | PARTICIPANT | Download QR as PNG image |

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violated |
| `STATE_ERROR` | 409 | Invalid state transition |
| `DESK_UNAVAILABLE` | 409 | No desk available for allocation |
| `ALREADY_JUDGED` | 409 | Judge already scored this team+round |
| `SUBMISSION_LOCKED` | 403 | Submission deadline passed |
| `ROUND_NOT_ACTIVE` | 403 | Operation requires active round |
| `INVITATION_INVALID` | 400 | Expired, revoked, or max-used invitation |
| `FILE_TOO_LARGE` | 413 | Upload exceeds size limit |
| `INVALID_FILE_TYPE` | 400 | Upload has invalid file type |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Rate Limiting Strategy

| Endpoint Group | Limit | Window |
|---|---|---|
| Auth endpoints | 10 req | 1 min |
| QR scan | 30 req | 1 min |
| Judgment submission | 10 req | 1 min |
| Registration | 5 req | 1 min |
| File upload | 5 req | 5 min |
| General API | 100 req | 1 min |
| SSE connections | 1 per event | Per user |
