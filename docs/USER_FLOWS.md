# User Flows — HackFlow

---

## 1. Organizer Flows

### 1.1 Event Creation Flow

```
Landing Page → "Create Event" button
    → Check auth:
        Unauthenticated → Google Sign-In → Redirect to Create Event
        Authenticated → Direct to Create Event

Create Event Page:
    1. Event Identity (name, slug, description)
    2. Timeline (registration open/close, event start/end)
    3. Team Constraints (min/max size, max teams, winner count)
    4. Registration Method:
        A. Native Form → Continue to Form Builder
        B. External Link → Paste Google Form URL
    5. Round Configuration (number of rounds, titles)
    6. Submit → Event created in DRAFT status
    
Post-creation:
    → Redirected to Event Dashboard
    → Dashboard shows: "Edit Form" + "Copy Participant Link"
    → Event in DRAFT until organizer explicitly opens registration
```

### 1.2 Venue Setup Flow

```
Event Dashboard → "Manage Venue" / "Rooms & Desks"
    → Room Cards grid (visual overview)
    → "+ Add Room" → Enter room name → Room created
    → Click room card → Desk Layout Modal opens
        → Desk grid with color coding (green=empty, red=filled)
        → "Add Desk" → New desk appended
        → "Generate X Desks" → Bulk creation
        → Each desk shows capacity badge
        → Red (filled) desks show tooltip: Team Name, Member Count
    → Drag-and-drop: Red desk → Green desk = Reassign team
```

### 1.3 Registration Management Flow

```
Event Dashboard → Open Registration (changes status: DRAFT → REGISTRATION_OPEN)
    → Registration link becomes active
    → Dashboard shows live capacity: "42/50 Teams | 38/50 Desks Filled"
    
For External Registration:
    → "Import Data" → Upload XLSX/CSV
    → Preview: "100 rows | 95 valid | 3 duplicate | 2 invalid"
    → Confirm → Teams created, desks allocated transactionally
    → Summary displayed
    
Close Registration:
    → Manual close OR automatic deadline
    → Status: REGISTRATION_OPEN → REGISTRATION_CLOSED
```

### 1.4 Event Day Operations Flow

```
Event Dashboard (during event):
    
1. Coordinator Distribution:
    → Generate coordinator link(s)
    → Share with volunteers
    
2. Live Attendance Monitor:
    → Real-time check-in feed
    → Progress bar: "42/50 Teams Checked In (84%)"
    → Entry method badges (QR vs Manual)
    
3. Judge Distribution:
    → Generate judge link(s)
    → Share with judges
    
4. Round Management:
    → Global Round Selector: [Round 1] [Round 2] [Round 3]
    → Start Round → Triggers problem reveal at scheduled time
    → Monitor submissions
    → Lock submissions (manual or deadline)
    → Enable judging
    
5. Live Scoring Matrix:
    → Round-filtered view
    → Per-team, per-judge, per-criterion scores
    → Averages calculated in real-time
    
6. Shortlisting:
    → Rankings page → Sort by total/criterion/judge count
    → Slider or numeric input: "Top N teams"
    → Preview shortlist
    → "Publish Results" → SSE broadcast to participants
    → If more rounds: shortlisted teams advance
    → If final round: publish final results
```

### 1.5 Desk Retention Flow (Round 2+)

```
Configuring Round 2:
    → "Retain Previous Allotments" toggle
    
    If ON:
        → Shortlisted teams keep their desks
        → Eliminated teams' desks released
        → If room needs to close:
            → Warning shown to organizer
            → Manual "Move Team" action for affected teams
            → Drag-and-drop specific team to new desk
    
    If OFF:
        → All desks released
        → Fresh auto-allot for shortlisted teams
        → Waitlisted teams from previous round eligible
```

### 1.6 Results & Certificates Flow

```
Final Round → Publish Results
    → Top N teams marked as winners
    → All participants eligible for participation certificates
    → "Generate Certificates" button
    → Server generates PDFs for all eligible recipients
    → Certificates appear in participant dashboards
    → "Download Certificate" becomes available
```

---

## 2. Participant (Team Leader) Flows

### 2.1 Registration Flow

```
Participant receives event link → Opens /event/[slug]

Check Auth:
    Unauthenticated → Google Sign-In → Return to event page
    
Check Registration Status:
    Already registered → Skip to Participant Dashboard
    Not registered + Native Form → Show Registration Form
    Not registered + External Form → Show Info: 
        "No user registered with this email. 
         Please fill out the registration form or contact coordinators."

Registration Form:
    1. Team Name (required)
    2. Team Members:
        → "How many members?" dropdown
        → Dynamic member fields appear (name, email, phone)
    3. Organizer's custom fields (dynamic from form_schema)
    4. Submit
        → Backend: validate → create team → allocate desk (transactional)
        → Success: show team details + assigned desk
        → No desk available: show "Registered (Waitlisted)" status
    5. → Redirect to Participant Dashboard
```

### 2.2 Dashboard Flow (Pre-Event)

```
Participant Dashboard:
    ┌─────────────────────────────────┐
    │  PERSISTENT QR MODULE           │
    │  ┌───────────┐                  │
    │  │  QR Code  │  [Download QR]   │
    │  └───────────┘                  │
    │                                 │
    │  Team: Team Turbo               │
    │  Leader: John Doe               │
    │  Members: 4                     │
    │                                 │
    │  📍 Room 3 | Desk 12            │
    │                                 │
    │  📋 Event Timeline              │
    │  • Registration closes: Sept 5  │
    │  • Event starts: Sept 10        │
    │                                 │
    │  📢 Announcements               │
    │  "Welcome! Check your desk..."  │
    └─────────────────────────────────┘
```

### 2.3 Active Round Flow

```
Round starts → Dashboard updates (SSE/polling):

    ┌─────────────────────────────────┐
    │  ROUND 1 - ACTIVE               │
    │                                 │
    │  🔔 Problem Statements:          │
    │  ┌─ Problem A: AI Healthcare ─┐ │
    │  │  Description...             │ │
    │  └────────────────────────────┘ │
    │  ┌─ Problem B: Smart City ────┐ │
    │  │  Description...             │ │
    │  └────────────────────────────┘ │
    │                                 │
    │  📌 Select Problem: [Dropdown]   │
    │                                 │
    │  🔗 GitHub Repo:                 │
    │  [ paste URL here ]             │
    │                                 │
    │  📎 Upload Presentation:         │
    │  [Choose File] (.pdf/.pptx)     │
    │                                 │
    │  [Submit Project]               │
    └─────────────────────────────────┘

After Submission:
    → Submission locked
    → UI shows: "Evaluation in Progress — Results announced soon"
    → QR remains visible for judge scanning
```

### 2.4 Result States

```
State transitions on participant dashboard:

PRE_EVENT:      "Event starts on Sept 10. Get ready!"
CHECK_IN:       "Show your QR at the registration desk"
ACTIVE_ROUND:   Problem statements + submission form
SUBMITTED:      "Evaluation in Progress"
SHORTLISTED:    "Congratulations! You've advanced to Round 2!" → New problem statements
ELIMINATED:     "Thank you for participating!" → Download Certificate of Participation
WINNER:         "🏆 You placed #2!" → Download Winner Certificate  
EVENT_COMPLETE: Final status + certificate download
```

---

## 3. Coordinator (Volunteer) Flows

### 3.1 Onboarding Flow

```
Coordinator receives link from organizer → /join?token=<token>

1. Check auth → Google Sign-In if needed
2. Token validation:
    → Valid: Create event_membership (role=COORDINATOR)
    → Expired/Revoked: Show error + contact organizer
3. → Redirect to Coordinator Scanner Dashboard
```

### 3.2 Scanner Dashboard

```
┌─────────────────────────────────────┐
│          COORDINATOR VIEW            │
│                                      │
│  ┌──────────────────────────────┐   │
│  │                              │   │
│  │     LIVE CAMERA FEED         │   │
│  │     (QR Scanner Active)      │   │
│  │                              │   │
│  └──────────────────────────────┘   │
│                                      │
│  ── TEAM ROSTER ──────────────────   │
│  🔍 [Search by name/leader...]      │
│                                      │
│  Team Turbo  | Room 3, Desk 12      │
│  Leader: John  ✅ Checked In         │
│                                      │
│  Team Alpha  | Room 1, Desk 5       │
│  Leader: Jane  ⬜ [Check In]        │
│                                      │
│  Team Beta   | Room 2, Desk 8       │
│  Leader: Alex  ⬜ [Check In]        │
│                                      │
└─────────────────────────────────────┘
```

### 3.3 Scan Workflow

```
QR Scanned → POST /api/events/[slug]/scan

Case 1: First check-in
    ┌──────────────────────────────┐
    │  ✅ CHECK-IN SUCCESSFUL       │
    │                              │
    │  Team: Team Turbo            │
    │  Leader: John Doe            │
    │                              │
    │  📍 Room 3 | Desk 12         │
    │                              │
    │  [Dismiss] [Next Scan]       │
    └──────────────────────────────┘

Case 2: Already checked in
    ┌──────────────────────────────┐
    │  ⚠️ ALREADY CHECKED IN       │
    │                              │
    │  Team: Team Turbo            │
    │  Checked in at: 09:15 AM    │
    │  By: Coordinator Sarah       │
    │                              │
    │  [Dismiss]                   │
    └──────────────────────────────┘

Case 3: Invalid QR
    ┌──────────────────────────────┐
    │  ❌ INVALID QR CODE           │
    │                              │
    │  This QR code is not valid   │
    │  for this event.             │
    │                              │
    │  [Try Again]                 │
    └──────────────────────────────┘
```

### 3.4 Manual Fallback

```
When QR scanning fails:
    → Coordinator uses search bar in roster
    → Finds team by name or leader
    → Taps "Check In" button
    → Confirmation modal: "Check in Team Turbo manually?"
    → Confirm → Team checked in
    → Method logged as 'MANUAL' in attendance_records
```

---

## 4. Judge Flows

### 4.1 Onboarding Flow

```
Judge receives link from organizer → /join?token=<token>

1. Check auth → Google Sign-In if needed
2. Token validation → Create event_membership (role=JUDGE)
3. → Redirect to Judge Scanner Dashboard
```

### 4.2 Scanner Dashboard

```
┌─────────────────────────────────────┐
│            JUDGE VIEW                │
│                                      │
│  ┌──────────────────────────────┐   │
│  │                              │   │
│  │     LIVE CAMERA FEED         │   │
│  │     (QR Scanner Active)      │   │
│  │                              │   │
│  └──────────────────────────────┘   │
│                                      │
│  ── TEAM ROSTER (Round 1) ────────   │
│  Active Room: Room 3                 │
│                                      │
│  📍 ROOM 3 (Current Context)        │
│  Team Gamma  | Desk 14  ⬜ [Judge]  │
│  Team Delta  | Desk 15  ⬜ [Judge]  │
│                                      │
│  📍 OTHER ROOMS                      │
│  Team Alpha  | Room 1, Desk 5       │
│             ✅ Evaluated              │
│  Team Beta   | Room 2, Desk 8       │
│             ⬜ [Judge]               │
│                                      │
│  ── [Show Completed] ─────────────   │
└─────────────────────────────────────┘
```

### 4.3 Scan → Judgment Workflow

```
QR Scanned → POST /api/events/[slug]/scan

Case 1: Team not yet judged by this judge
    ┌──────────────────────────────┐
    │  Team: Team Turbo            │
    │  Leader: John Doe            │
    │  Room 3, Desk 12             │
    │                              │
    │  ℹ️ Already evaluated by:     │
    │  Judge Smith, Judge Davis    │
    │                              │
    │  [Confirm] [Cancel]          │
    └──────────────────────────────┘
    
    → Confirm → Open Evaluation Sheet

Case 2: Already judged by THIS judge
    ┌──────────────────────────────┐
    │  ⚠️ ALREADY JUDGED BY YOU    │
    │                              │
    │  Team: Team Turbo            │
    │  You evaluated this team     │
    │  at 10:42 AM                 │
    │                              │
    │  [Scan Another]              │
    └──────────────────────────────┘
```

### 4.4 Evaluation Sheet

```
┌─────────────────────────────────────┐
│  EVALUATING: Team Turbo              │
│  Round 1 | Room 3, Desk 12          │
│                                      │
│  Innovation (max: 5)                 │
│  [1] [2] [3] [4] [5]    ← Quick tap │
│                                      │
│  Technical Execution (max: 15)       │
│  [-] [ 7 ] [+]    ← Stepper (50%)  │
│                                      │
│  Presentation (max: 10)              │
│  [-] [ 5 ] [+]    ← Stepper (50%)  │
│                                      │
│  Impact (max: 5)                     │
│  [1] [2] [3] [4] [5]    ← Quick tap │
│                                      │
│  [Submit Evaluation]                 │
└─────────────────────────────────────┘

UI Rules:
    max ≤ 5  → Quick-tap buttons
    max > 5  → Stepper with +/- buttons
    Default  → ceil(max / 2)  (50% rounded up)
```

### 4.5 Post-Submission

```
Submit → POST /api/events/[slug]/judgments

    ┌──────────────────────────────┐
    │  ✅ EVALUATION SUBMITTED      │
    │                              │
    │  Team Turbo scored.          │
    │                              │
    │  [UNDO (8s)]                 │
    │                              │
    │  [Scan Another]              │
    └──────────────────────────────┘

→ 10-second undo window
→ After window closes: judgment finalized
→ "Scan Another" → Camera resets
→ Roster re-sorts with smart sorting (current room first)
```

### 4.6 Smart Sorting Algorithm

```
When judge evaluates a team in Room X:
    activeRoomContext = Room X

Roster sort order:
    1. PENDING teams in activeRoomContext room → sorted by desk_number
    2. PENDING teams in other rooms → sorted by room_number, desk_number
    3. EVALUATED teams → hidden behind "Show Completed" toggle

When judge scans/selects a team in a different room:
    → activeRoomContext updates to new room
    → Roster re-sorts
```

---

## 5. Landing Page Flow

```
┌─────────────────────────────────────┐
│                                      │
│         HackFlow                     │
│    Run your hackathon,               │
│    not your spreadsheets.            │
│                                      │
│    [Create Event]  [Sign In]         │
│                                      │
└─────────────────────────────────────┘

"Sign In" → Google OAuth → Event List Page
    → Shows all user's events
    → Click event → Event Dashboard
    → FAB "+" → Create Event

"Create Event" → 
    Unauthenticated → Google OAuth → Create Event Page (intent preserved)
    Authenticated → Create Event Page directly
```

---

## 6. Route Architecture

```
/                                    → Landing page
/auth/signin                         → Google Sign-In
/auth/callback                       → OAuth callback

/events                              → Event list (authenticated)
/events/new                          → Create event (authenticated)
/events/[slug]                       → Event public page
/events/[slug]/dashboard             → Organizer dashboard
/events/[slug]/dashboard/venue       → Rooms & desks management
/events/[slug]/dashboard/teams       → Team roster
/events/[slug]/dashboard/attendance  → Live attendance
/events/[slug]/dashboard/rounds      → Round management
/events/[slug]/dashboard/judging     → Judgment builder + matrix
/events/[slug]/dashboard/rankings    → Shortlist + rank management
/events/[slug]/dashboard/settings    → Event configuration

/events/[slug]/participant           → Participant dashboard
/events/[slug]/coordinator           → Coordinator scanner dashboard
/events/[slug]/judge                 → Judge scanner dashboard

/join                                → Accept invitation (?token=...)
```
