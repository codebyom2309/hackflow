# Architectural Decisions — HackFlow

This document records every significant architectural decision. It is append-only — decisions are never silently overwritten. If a decision is reversed, a new entry supersedes the original with a cross-reference.

---

## D-001: QR Token Architecture

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
Should QR tokens be rotating JWTs (time-based, short-lived) or static HMAC-signed tokens?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. Rotating JWT** | Prevents replay; time-bound | Downloaded QR becomes useless after expiry; requires constant internet to refresh; adds complexity |
| **B. Static HMAC-signed token** | Works offline; downloadable; simple; event-bound | Token doesn't expire; screenshot sharing possible |
| **C. Hybrid (static + rotation on scan)** | Combines offline capability with some rotation | Complex; marginal security benefit for physical events |

### Decision: **B — Static HMAC-signed token**

### Reason
1. **Offline requirement is non-negotiable**: Participants download QR before arriving at venue. A rotating token makes downloaded QR useless after seconds/minutes.
2. **Physical venue context**: QR identifies a *team*, not an individual. Sharing a QR screenshot just means someone else can show the same team's QR — but check-in is a one-time operation (duplicate detected), and judge scoring has a unique constraint.
3. **HMAC provides tamper-proofing**: Cannot forge a valid QR without the server-side event secret.
4. **Event-bound**: QR contains event_id, preventing cross-event reuse.
5. **Risk is acceptable**: In a physical hackathon, all participants are physically present. The threat model is not adversarial in the way a financial system would be.

### Consequences
- QR token is generated once at registration and never changes
- QR is downloadable as an image
- HMAC validation on every scan
- Per-event HMAC secrets (not a global secret)
- If a team is deleted/removed, their QR naturally becomes invalid (team lookup fails)

---

## D-002: Desk Allocation Concurrency Strategy

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
How to prevent race conditions during concurrent desk allocation in TiDB?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. PostgreSQL SKIP LOCKED** | Elegant, purpose-built | ❌ Not supported in TiDB |
| **B. Pessimistic locking (FOR UPDATE)** | Supported in TiDB; correct | Concurrent requests wait instead of skip; potential for queue backup under extreme load |
| **C. Optimistic locking (version column)** | No blocking | Requires retry logic; more complex |
| **D. Application-level queue** | Serializes allocation | Adds infrastructure complexity (Redis/queue) |

### Decision: **B — Pessimistic locking with FOR UPDATE**

### Reason
1. `SKIP LOCKED` is not available in TiDB (confirmed via research).
2. TiDB supports pessimistic transactions as default mode — `SELECT ... FOR UPDATE` acquires row locks.
3. For hackathon registration volumes (tens to low hundreds concurrent), waiting transactions are acceptable.
4. Transaction timeout (5s) prevents indefinite blocking.
5. Application-level retry with exponential backoff + jitter handles transient lock contention.

### Implementation
```sql
START TRANSACTION;
SELECT id FROM desks 
WHERE room_id IN (...) AND is_allocated = FALSE AND capacity >= ?
ORDER BY room_id, desk_number LIMIT 1
FOR UPDATE;
-- If row returned: UPDATE desks SET is_allocated = TRUE, ...
COMMIT;
-- If no row: team registered as WAITLISTED
```

### Consequences
- Under concurrent load, some registrations will briefly wait (~100-500ms)
- If wait exceeds 5s, transaction fails → application retries
- Maximum 3 retries with jitter before returning error
- Monitoring for lock wait timeouts recommended

---

## D-003: Real-Time Update Strategy

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
How to implement real-time updates for event state changes, announcements, and live data?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. WebSockets** | Full-duplex; instant | Requires persistent connections; complex in serverless; connection management overhead |
| **B. Server-Sent Events (SSE)** | Simple; HTTP-based; automatic reconnection; one-way server→client | One-directional only; limited concurrent connections per browser |
| **C. HTTP Polling** | Simplest; no persistent connections | Latency; unnecessary requests when no updates; server load |
| **D. SSE primary + Polling fallback** | Best of B + C | Slightly more code for fallback |

### Decision: **D — SSE primary + Polling fallback**

### Reason
1. Nearly all real-time requirements are server→client: round status, announcements, results, scoring updates.
2. Client→server communication uses standard REST API calls (judgment submission, attendance check-in).
3. SSE works over standard HTTP — compatible with CDNs, load balancers, and most deployment environments.
4. SSE has built-in reconnection via `EventSource` API.
5. Polling fallback handles environments where SSE connections time out or are limited.
6. WebSockets are overkill: no chat, no collaborative editing, no high-frequency bidirectional communication.

### Implementation
- SSE endpoint: `GET /api/events/[slug]/sse`
- Client subscribes on dashboard mount
- On reconnect: full state fetch from REST API
- Polling interval: 5 seconds (when SSE unavailable)
- Server maintains in-memory connection map per event

### Consequences
- No WebSocket dependency
- No Redis pub/sub needed for small-medium events
- For very large events (1000+ concurrent connections), consider adding Redis pub/sub behind SSE
- Each SSE connection holds a server-side stream open — monitor connection count

---

## D-004: Judge Undo / Score Correction Model

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
How should the system handle accidental judge submissions and score corrections?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. 5-second undo toast only** | Simple; instant; good UX | Window too short; what about mistakes discovered later? |
| **B. Organizer-only correction** | Clean audit trail | Slow; requires organizer intervention for every typo |
| **C. Timed undo + judge self-correction + organizer override** | Flexible; audit-safe | More complex |

### Decision: **C — Three-tier correction model**

### Details
1. **Undo window (10 seconds)**: Immediately after submitting, judge sees "UNDO" button. If pressed within 10 seconds, the judgment is soft-deleted (or marked as undone). The scores are not yet "finalized" during this window.
2. **Judge self-correction**: After the undo window, judge can request a correction through a dedicated interface. This creates a `judgment_corrections` record (original preserved, correction recorded with reason).
3. **Organizer override**: Organizer can correct any score from the scoring matrix dashboard. This also creates a `judgment_corrections` record.

### Audit Trail
```
judgment_scores: Always contains the CURRENT active score
judgment_corrections: Contains history of all changes:
    - original_score
    - corrected_score
    - corrected_by (judge or organizer user_id)
    - reason (text)
    - created_at
```

### Consequences
- Raw historical scores are always recoverable
- Organizer can audit: who scored what, when, and any corrections
- The 10-second undo window covers the most common case (fat-finger)
- Correction flow covers discovered-later mistakes

---

## D-005: Judge Scans Team That Has Not Checked In

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
If a judge scans a team QR but the team has `attended = FALSE` (not checked in by coordinator), should the system block the judge or automatically mark attendance?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. Block the judge** | Enforces check-in process | Judge's workflow interrupted; team is clearly physically present |
| **B. Auto-mark attendance + allow judging** | Judge not blocked; team clearly present (judge found them at their desk) | Attendance might have administrative meaning beyond "physically present" |
| **C. Allow judging WITHOUT marking attendance; show warning** | Judge proceeds; attendance handled separately | Inconsistent data (judged but not attended) |

### Decision: **B — Auto-mark attendance + allow judging (with audit)**

### Reason
1. A judge physically standing at a team's desk and scanning their QR is **stronger evidence of presence** than any coordinator scan.
2. Blocking the judge wastes their time and creates operational friction.
3. The auto-mark is logged in `attendance_records` with `check_in_method = 'JUDGE_SCAN'` for audit clarity.
4. The organizer dashboard clearly shows the check-in method so they can investigate if needed.

### Consequences
- New `check_in_method` enum value: `'JUDGE_SCAN'`
- Attendance record created with `checked_in_by = judge_user_id`
- Judge dashboard shows a brief info toast: "Team checked in automatically"
- Organizer can filter attendance by method to identify teams that bypassed coordinator

---

## D-006: Judge Draft / In-Progress State

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
If a judge opens a team's evaluation sheet and backs out without submitting, should the team be marked as "Draft/In Progress"?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. Mark as Draft; lock from other judges** | Prevents wasted effort | Judges are INDEPENDENT; locking one judge out because another opened the sheet is wrong |
| **B. No draft state; revert to Pending** | Simple; no cross-judge interference | Judge loses partial work |
| **C. Judge-private draft; no cross-judge lock** | Judge can resume their own draft; other judges unaffected | Slightly more complex |

### Decision: **C — Judge-private draft, no cross-judge lock**

### Reason
1. Judges are **independent evaluators**. One judge opening a sheet must NEVER block another judge.
2. A draft is useful only for restoring the same judge's unfinished work (e.g., phone accidentally locked).
3. Drafts are stored in `localStorage` on the judge's device (not in the database) — zero server-side complexity.
4. Drafts auto-expire after 30 minutes.
5. No database changes required.

### Consequences
- Judge opens sheet → scores cached in `localStorage` with key: `draft:{eventId}:{teamId}:{roundId}:{judgeId}`
- If judge navigates back → draft preserved in localStorage
- If judge opens same team again → draft restored, prompt "Resume from draft?"
- If judge opens different team → previous draft persists (can be resumed later)
- Drafts never block other judges
- Drafts never appear in organizer's view
- Drafts expire after 30 minutes (localStorage TTL check)

---

## D-007: Database ORM Choice

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
Should we use Prisma, Drizzle, or raw SQL for database access?

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. Prisma** | Popular; excellent DX; auto-generated types | Heavier runtime; edge compatibility issues; less control over complex queries |
| **B. Drizzle ORM** | Lightweight; type-safe; SQL-like syntax; TiDB native driver support; edge-compatible | Smaller ecosystem; newer |
| **C. Raw SQL** | Full control | No type safety; error-prone; verbose |

### Decision: **B — Drizzle ORM**

### Reason
1. Official `@tidbcloud/serverless` driver integration with Drizzle
2. Lightweight — no heavy runtime like Prisma Client
3. SQL-like query builder means complex queries (desk allocation with `FOR UPDATE`) are natural
4. Type-safe schema definition that generates TypeScript types
5. Drizzle Kit for migration management
6. Edge-compatible for potential Vercel Edge deployment

---

## D-008: User Model (Unified vs Split)

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
Should organizers and participants have separate user tables (as in the research) or a unified user table?

### Decision: **Unified `users` table + event-scoped `event_memberships`**

### Reason
The research's split model (`organizers` + `participants` tables) assumes a user has one permanent role. In reality:
- Same person may organize Event A and participate in Event B
- Judge for one event might be coordinator for another
- No reason to duplicate authentication/profile data

A single `users` table with event-scoped role assignment via `event_memberships` is simpler, more flexible, and avoids data duplication.

---

## D-009: Form Schema Storage

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
Store dynamic form schemas as JSON column or Entity-Attribute-Value (EAV) tables?

### Decision: **JSON column on `events.form_schema`**

### Reason
1. Form schemas are read/written as complete units, not queried field-by-field
2. TiDB has full JSON support (`JSON_EXTRACT`, `->`, `->>`)
3. EAV tables would over-normalize this use case and create painful queries
4. Form responses stored as JSON on `teams.form_responses`
5. Schema validation happens in the application layer (Zod)

---

## D-010: Day/Night UI Toggle

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
How to implement the glassmorphism (dark) and skeuomorphism (light) UI modes?

### Decision: **CSS custom properties with `data-theme` attribute on `<html>` element**

### Reason
1. CSS custom properties (design tokens) allow runtime theme switching without page reload
2. `data-theme="night"` (default) → glassmorphism: frosted glass, blur, gradients, dark canvas
3. `data-theme="day"` → skeuomorphism: light surfaces, tactile textures, shadows
4. User preference stored in `localStorage` + respects `prefers-color-scheme`
5. No JavaScript-in-CSS needed; pure CSS approach

### Implementation
```css
[data-theme="night"] {
    --color-canvas: #0a0a0b;
    --color-surface-1: #1a1a1d;
    --color-surface-2: #2a2a2e;
    --color-ink: #ffffff;
    --color-ink-muted: #999999;
    --glass-bg: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --glass-blur: blur(20px);
    /* ... */
}

[data-theme="day"] {
    --color-canvas: #f5f5f0;
    --color-surface-1: #ffffff;
    --color-surface-2: #eeeee8;
    --color-ink: #1a1a1a;
    --color-ink-muted: #666666;
    --glass-bg: rgba(255, 255, 255, 0.7);
    --glass-border: rgba(0, 0, 0, 0.1);
    --glass-blur: blur(10px);
    /* ... */
}
```

---

## D-011: Ranking Override Architecture

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
How to handle manual ranking overrides without destroying raw calculated scores?

### Decision: **Dual-rank columns in `shortlists` table**

### Implementation
- `calculated_rank`: Always reflects raw aggregate scores. Updated on every recalculation.
- `final_rank`: NULL by default (= use calculated_rank). Set by organizer for overrides.
- Display rank: `COALESCE(final_rank, calculated_rank)`
- Override action logged in `audit_logs` with `action = 'rank.overridden'`

### Consequences
- Raw scores in `judgment_scores` are NEVER modified
- `calculated_rank` is NEVER manually modified
- Only `final_rank` is set by organizer
- Full audit trail: who overrode, when, from what rank to what rank
- Rankings can be "reset to calculated" by setting `final_rank = NULL`

---

## D-012: Desk Retention Between Rounds

**Date**: Level 0 (Planning)  
**Status**: DECIDED  

### Question
How to handle desk retention when a room needs to close between rounds?

### Decision: **Per-round retention flag + selective manual override**

### Implementation
1. `rounds.retain_desks` boolean — if TRUE, shortlisted teams keep their desks
2. When publishing round results with `retain_desks = TRUE`:
   - Shortlisted teams: desk retained (no change)
   - Eliminated teams: desk released (`is_allocated = FALSE`)
3. If a room is deactivated (`rooms.is_active = FALSE`):
   - Dashboard warns organizer about affected teams
   - Organizer uses "Move Team" action to reassign individually
   - Other retained teams are NOT disturbed
4. Manual moves are audited in `audit_logs`

### Consequences
- No forced mass reallocation when one room closes
- Organizer has surgical control over specific teams
- Capacity validation on destination desk before move
- Audit trail for all desk changes
