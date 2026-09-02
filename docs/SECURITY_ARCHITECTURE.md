# Security Architecture — HackFlow

---

## 1. Authentication

### Provider: NextAuth.js v5 + Google OAuth 2.0

```
User clicks "Sign In"
    → Redirected to Google OAuth consent
    → Google returns authorization code
    → NextAuth exchanges for tokens
    → NextAuth creates/updates user in `users` table
    → Session cookie set (httpOnly, secure, sameSite)
    → User redirected to appropriate dashboard
```

### Session Management
- **Session strategy**: JWT-based sessions via NextAuth
- **Cookie security**: `httpOnly`, `secure` (HTTPS only), `sameSite: lax`
- **Session lifetime**: 7 days with sliding expiration
- **Session data**: `{ userId, email, name }` — NO role stored in session (role is event-scoped)

### Why No Role in Session
Roles are event-scoped. A user's role is determined per-request by querying `event_memberships` for the specific event being accessed. Storing role in session would create stale state for users with multi-event roles.

---

## 2. Authorization

### Layered Authorization Model

```
Request
    → Middleware (1. Check authentication)
    → Route Handler (2. Extract event context)
    → Auth Guard (3. Check event membership + role)
    → Service Layer (4. Check resource ownership)
    → Database (5. Constraint-level protection)
```

### Authorization Guard Implementation

```typescript
// Example: protect a route requiring ORGANIZER role
async function requireRole(eventSlug: string, ...roles: Role[]) {
    const session = await auth();
    if (!session?.user) throw new AuthError('AUTH_REQUIRED');
    
    const membership = await db.query.eventMemberships.findFirst({
        where: and(
            eq(eventMemberships.userId, session.user.id),
            eq(eventMemberships.eventId, event.id),
            inArray(eventMemberships.role, roles)
        )
    });
    
    if (!membership) throw new AuthError('FORBIDDEN');
    return { user: session.user, membership };
}
```

### Resource Ownership Verification
- **Teams**: Participant can only access teams where `leader_id = session.userId`
- **Judgments**: Judge can only submit/correct their own judgments
- **Events**: Organizer can only manage events they created
- **Certificates**: Participant can only download certificates for their own team
- **Submissions**: Only team leader can submit/update

### Server-Side Only
- **NEVER** trust client-side role checks for security
- Frontend may hide/show UI elements based on role, but every API call re-verifies
- All protected operations re-derive user identity from session
- No user-provided `role`, `user_id`, `team_id` trusted without verification

---

## 3. Invitation Token Security

### Token Generation
```
token = crypto.randomBytes(32).toString('hex')
```

### Invitation Acceptance Flow
```
1. User receives link: /join?token=<token>
2. User authenticates with Google (if not already)
3. POST /api/invitations/accept { token }
4. Server validates:
   a. Token exists in role_invitations
   b. Token is not revoked (is_revoked = FALSE)
   c. Token has not expired (expires_at > NOW())
   d. Token has remaining uses (use_count < max_uses)
5. If valid:
   a. Create event_membership record
   b. Increment use_count
   c. Return success
6. If invalid:
   a. Return specific error (expired/revoked/exhausted)
```

### Token Properties
| Property | Value |
|---|---|
| Length | 64 hex characters (32 bytes) |
| Default expiry | 7 days |
| Default max uses | Unlimited (shareable link) or 1 (personal invite) |
| Revocable | Yes, by organizer |
| Reusable | Configurable per invitation |

### Protections
- Token alone does NOT grant access — Google auth required
- Expired tokens cannot be used
- Revoked tokens cannot be used
- Single-use tokens are consumed on first valid use
- Invitation acceptance is logged in audit_logs

---

## 4. QR Token Security

### Token Format
```
hackflow:<event_id>:<team_id>:<hmac_signature>
```

### HMAC Generation
```typescript
const payload = `${eventId}:${teamId}`;
const signature = crypto
    .createHmac('sha256', event.qr_secret)
    .update(payload)
    .digest('hex');
const qrContent = `hackflow:${eventId}:${teamId}:${signature}`;
```

### Validation on Scan
```typescript
function validateQR(qrContent: string, event: Event): { teamId: string } | null {
    const parts = qrContent.split(':');
    if (parts.length !== 4 || parts[0] !== 'hackflow') return null;
    
    const [, eventId, teamId, providedSig] = parts;
    if (eventId !== event.id) return null;  // Event binding
    
    const expectedSig = crypto
        .createHmac('sha256', event.qr_secret)
        .update(`${eventId}:${teamId}`)
        .digest('hex');
    
    if (!crypto.timingSafeEqual(
        Buffer.from(providedSig), 
        Buffer.from(expectedSig)
    )) return null;  // Tamper detection
    
    return { teamId };
}
```

### Threat Model
| Threat | Mitigation |
|---|---|
| QR forgery | HMAC prevents creating valid QR without server secret |
| Cross-event QR reuse | Event ID embedded and validated; per-event HMAC key |
| QR screenshot sharing | Acceptable risk — QR identifies team, not individual. Check-in is a one-time operation |
| QR replay (same team scanned twice) | Attendance record prevents duplicate check-in. Judge uniqueness constraint prevents duplicate scoring |
| Brute force QR generation | Rate limiting on scan endpoint; 256-bit HMAC space is infeasible to brute-force |

---

## 5. Input Validation

### Strategy: Validate at Every Layer

```
Client (UX feedback) → API (Zod schema) → Service (business rules) → Database (constraints)
```

### Zod Schema Examples

```typescript
// Registration
const registerTeamSchema = z.object({
    teamName: z.string().min(2).max(100).trim(),
    members: z.array(z.object({
        name: z.string().min(1).max(100).trim(),
        email: z.string().email().max(255),
        phone: z.string().regex(/^\+?[\d\s-]{10,15}$/).optional(),
    })).min(1).max(10),
    formResponses: z.record(z.string(), z.any()).optional(),
});

// Judgment submission
const submitJudgmentSchema = z.object({
    team_id: z.string().uuid(),
    round_id: z.string().uuid(),
    idempotency_key: z.string().min(1).max(255),
    scores: z.array(z.object({
        criteria_id: z.string().uuid(),
        score: z.number().int().min(0),
    })).min(1),
});
```

### SQL Injection Prevention
- All database queries go through Drizzle ORM (parameterized by default)
- No raw SQL string concatenation
- User input never interpolated into query strings

### XSS Prevention
- React's JSX auto-escapes output by default
- `dangerouslySetInnerHTML` prohibited unless explicitly justified
- Content-Security-Policy headers configured
- User-generated content sanitized before storage

### File Upload Security
| Check | Implementation |
|---|---|
| File type | Validate MIME type against allowlist + magic bytes check |
| File size | Enforce limits before processing (50MB PPT, 10MB XLSX) |
| Filename | Sanitize: strip path traversal, replace special chars, limit length |
| Content | Scan uploaded files are valid PDF/PPTX/XLSX (not renamed malware) |
| Storage | Files stored with generated keys, never user-provided filenames |
| Access | Signed URLs with expiry for downloads; no direct storage access |

---

## 6. CSRF Protection

- NextAuth.js v5 includes built-in CSRF protection for auth endpoints
- All state-changing API routes use POST/PUT/PATCH/DELETE (not GET)
- `SameSite=Lax` cookies prevent CSRF from cross-origin forms
- For additional protection: custom CSRF token header on sensitive mutations

---

## 7. IDOR (Insecure Direct Object Reference) Prevention

| Resource | Protection |
|---|---|
| Team data | Query always filters by authenticated user's event membership |
| Submissions | Only team leader can submit; query scoped by `leader_id = session.userId` |
| Judgments | Judge ID derived from session, never from request body |
| Events | Operations check `event_memberships` for authenticated user |
| Certificates | Download endpoint verifies certificate belongs to user's team |
| Other teams' data | Participants never receive other teams' data in API responses |

### Implementation Pattern
```typescript
// WRONG: Trust user-provided teamId
const team = await db.query.teams.findFirst({
    where: eq(teams.id, req.body.teamId)  // ❌ IDOR vulnerability
});

// RIGHT: Scope query by authenticated user
const team = await db.query.teams.findFirst({
    where: and(
        eq(teams.id, req.body.teamId),
        eq(teams.eventId, event.id),        // Event scoping
        eq(teams.leaderId, session.userId)   // Ownership scoping
    )
});
```

---

## 8. Rate Limiting

### Implementation: In-memory rate limiter (upgrade to Redis for production scale)

```typescript
// Example: Token bucket algorithm
const rateLimits = {
    'scan':       { maxTokens: 30, refillRate: 0.5, window: 60 },  // 30/min
    'register':   { maxTokens: 5,  refillRate: 0.08, window: 60 }, // 5/min
    'judgment':   { maxTokens: 10, refillRate: 0.17, window: 60 }, // 10/min
    'upload':     { maxTokens: 5,  refillRate: 0.017, window: 300 }, // 5/5min
    'default':    { maxTokens: 100, refillRate: 1.67, window: 60 }, // 100/min
};
```

### Rate limit responses
- HTTP 429 Too Many Requests
- `Retry-After` header with seconds until next allowed request
- `X-RateLimit-Remaining` header for client awareness

---

## 9. Secret Management

### Environment Variables (`.env.example`)
```env
# Authentication
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database
DATABASE_URL=
TIDB_HOST=
TIDB_PORT=
TIDB_USER=
TIDB_PASSWORD=
TIDB_DATABASE=

# Storage
STORAGE_PROVIDER=      # 'local' | 's3'
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Application
APP_URL=
QR_HMAC_FALLBACK_SECRET=   # Fallback; per-event secrets preferred
```

### Rules
- **NEVER** commit `.env` to version control
- `.env.example` contains key names only, no values
- Secrets injected via deployment environment
- Per-event QR secrets stored in database (not in env)
- All secrets are cryptographically random, minimum 32 bytes

---

## 10. Audit Logging

### What Gets Logged

| Category | Actions |
|---|---|
| Authentication | Login, logout, failed login |
| Authorization | Access denied events |
| Team management | Register, waitlist, eliminate, manual check-in |
| Desk operations | Assign, reassign, release, bulk allot |
| Judging | Submit score, correct score, override score |
| Round management | Start, lock submissions, publish results |
| Rankings | Override rank, publish shortlist |
| Invitations | Create, accept, revoke |
| Event config | Status change, setting modification |
| Data import | XLSX upload, validation results |

### Audit Log Entry Structure
```typescript
{
    event_id: string;
    user_id: string;
    action: string;           // 'score.corrected'
    entity_type: string;      // 'judgment_scores'
    entity_id: string;        // ID of affected record
    details: {                // Action-specific context
        original_score: 7,
        corrected_score: 9,
        criteria_name: 'Innovation'
    };
    ip_address: string;
    user_agent: string;
    created_at: Date;
}
```

### Retention
- Audit logs retained for the lifetime of the event
- No automatic purging
- Organizer can export audit logs as CSV

---

## 11. Deployment Security Checklist

- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers configured (CSP, X-Frame-Options, HSTS, etc.)
- [ ] No secrets in source code or client bundles
- [ ] Database connection uses TLS
- [ ] File storage uses signed URLs (not public buckets)
- [ ] Rate limiting active on all public endpoints
- [ ] Error responses do not leak stack traces in production
- [ ] Auth cookies are httpOnly, secure, sameSite
- [ ] CORS configured to allow only trusted origins
- [ ] Dependencies audited for known vulnerabilities
