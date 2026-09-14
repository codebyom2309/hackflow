"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./coordinator.module.css";
import { useToast } from "@/components/ui/Toast";

interface DeskSummary {
  deskNumber: number;
  roomName: string;
}

interface RosterItem {
  teamId: string;
  teamName: string;
  memberCount: number;
  status: string;
  isCheckedIn: boolean;
  attendanceRecordId: string | null;
  checkedInAt: Date | string | null;
  checkInMethod: string | null;
  desk: DeskSummary | null;
  college?: string | null;
  problemStatement?: string | null;
}

interface AttendanceStats {
  total: number;
  checkedIn: number;
  pending: number;
  rate: number;
}

interface HelpRequestItem {
  id: string;
  category: string;
  priority: string;
  description: string;
  location: string | null;
  status: string;
  assignedStaffId: string | null;
  resolutionNotes: string | null;
  createdAt: Date | string | null;
  team: { id: string; name: string } | null;
  participant: { id: string; name: string | null; email: string } | null;
  assignedStaff: { id: string; name: string | null; email: string } | null;
}

interface EventSummary {
  id: string;
  title: string;
  slug: string;
}

interface CoordinatorScannerProps {
  event: EventSummary;
  initialRoster: RosterItem[];
  initialStats: AttendanceStats;
}

type CoordinatorTab = "home" | "scan" | "roster" | "desks" | "help";

const CATEGORY_ICONS: Record<string, string> = {
  TECHNICAL_ISSUE: "💻",
  VENUE_ISSUE: "🔌",
  REGISTRATION_ISSUE: "📋",
  TEAM_ISSUE: "👥",
  FOOD_FACILITIES: "🍕",
  MENTOR_STAFF: "🙋",
  JUDGE_RELATED: "⚖️",
  SUBMISSION_ISSUE: "📤",
  OTHER: "❓",
};

export default function CoordinatorScanner({
  event,
  initialRoster,
  initialStats,
}: CoordinatorScannerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<CoordinatorTab>("scan");
  const [roster, setRoster] = useState<RosterItem[]>(initialRoster);
  const [stats, setStats] = useState<AttendanceStats>(initialStats);
  const [search, setSearch] = useState("");

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: "success" | "warning" | "error";
    message: string;
    teamName?: string;
    deskNumber?: number;
    roomName?: string;
  } | null>(null);

  const [processingManualId, setProcessingManualId] = useState<string | null>(null);
  const [personalScans, setPersonalScans] = useState(0);
  const scannerRef = useRef<unknown>(null);
  const isScanningRef = useRef(false);

  // Help Requests state
  const [helpRequests, setHelpRequests] = useState<HelpRequestItem[]>([]);
  const [helpFilter, setHelpFilter] = useState<string>("ALL");
  const [loadingHelp, setLoadingHelp] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<HelpRequestItem | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [updatingTicket, setUpdatingTicket] = useState(false);

  // Fetch help requests
  const fetchHelpRequests = useCallback(async () => {
    try {
      setLoadingHelp(true);
      const res = await fetch(`/api/events/${event.slug}/help-requests`);
      if (res.ok) {
        const json = await res.json();
        setHelpRequests(json.data || []);
      }
    } catch {
      console.error("Failed to load help requests");
    } finally {
      setLoadingHelp(false);
    }
  }, [event.slug]);

  useEffect(() => {
    fetchHelpRequests();
    const interval = setInterval(fetchHelpRequests, 15000); // Polling 15s
    return () => clearInterval(interval);
  }, [fetchHelpRequests]);

  // Optical QR scan handler
  const handleScan = useCallback(
    async (payload: string) => {
      if (isScanningRef.current) return;
      isScanningRef.current = true;

      try {
        const res = await fetch(`/api/events/${event.slug}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const json = await res.json();

        if (res.ok) {
          const { team, alreadyCheckedIn, desk } = json.data;
          setPersonalScans((p) => p + 1);

          if (alreadyCheckedIn) {
            setScanResult({
              status: "warning",
              message: "Team is ALREADY checked in!",
              teamName: team.name,
              deskNumber: desk?.deskNumber,
              roomName: desk?.roomName,
            });
            toast.warning(`Already checked in: ${team.name}`);
          } else {
            setScanResult({
              status: "success",
              message: "✓ Check-in Verified!",
              teamName: team.name,
              deskNumber: desk?.deskNumber,
              roomName: desk?.roomName,
            });
            toast.success(`Checked in: ${team.name}`);

            // Update roster and stats state
            setRoster((prev) =>
              prev.map((t) =>
                t.teamId === team.id
                  ? { ...t, isCheckedIn: true, status: "CHECKED_IN", desk: desk || t.desk }
                  : t
              )
            );
            setStats((prev) => ({
              ...prev,
              checkedIn: prev.checkedIn + 1,
              pending: Math.max(0, prev.pending - 1),
              rate: ((prev.checkedIn + 1) / prev.total) * 100,
            }));
          }
        } else {
          setScanResult({
            status: "error",
            message: json.error || "Invalid QR badge payload",
          });
          toast.error(json.error || "Scan failed");
        }
      } catch {
        toast.error("Network error during scan");
      } finally {
        setTimeout(() => {
          isScanningRef.current = false;
        }, 1500);
      }
    },
    [event.slug, toast]
  );

  // Initialize Html5Qrcode camera when on "scan" tab
  useEffect(() => {
    let html5QrCode: any = null;

    if (activeTab === "scan") {
      setScanning(true);
      import("html5-qrcode")
        .then(({ Html5Qrcode }) => {
          html5QrCode = new Html5Qrcode("coordinator-qr-reader");
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText: string) => handleScan(decodedText),
              () => {}
            )
            .catch(() => {
              setScanning(false);
              toast.error("Camera access denied or unavailable");
            });
        })
        .catch(() => {
          setScanning(false);
          toast.error("Failed to load camera scanner component");
        });
    }

    return () => {
      if (scannerRef.current) {
        try {
          (scannerRef.current as any).stop().catch(() => {});
        } catch {
          // ignore
        }
        setScanning(false);
      }
    };
  }, [activeTab, handleScan, toast]);

  // Manual fallback check-in
  async function handleManualCheckIn(teamId: string) {
    setProcessingManualId(teamId);
    try {
      const res = await fetch(`/api/events/${event.slug}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, method: "MANUAL" }),
      });
      const json = await res.json();

      if (res.ok) {
        toast.success("Team checked in manually!");
        setRoster((prev) =>
          prev.map((t) =>
            t.teamId === teamId
              ? { ...t, isCheckedIn: true, status: "CHECKED_IN", desk: json.data?.desk || t.desk }
              : t
          )
        );
        setStats((prev) => ({
          ...prev,
          checkedIn: prev.checkedIn + 1,
          pending: Math.max(0, prev.pending - 1),
          rate: ((prev.checkedIn + 1) / prev.total) * 100,
        }));
      } else {
        toast.error(json.error || "Manual check-in failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setProcessingManualId(null);
    }
  }

  // Claim help ticket
  async function handleClaimTicket(ticketId: string) {
    try {
      const res = await fetch(`/api/events/${event.slug}/help-requests/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });

      if (res.ok) {
        const json = await res.json();
        setHelpRequests((prev) =>
          prev.map((r) => (r.id === ticketId ? json.data : r))
        );
        toast.success("Ticket claimed! Head to the participant's desk.");
      } else {
        toast.error("Failed to claim ticket");
      }
    } catch {
      toast.error("Network error");
    }
  }

  // Resolve help ticket
  async function handleResolveTicket() {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/help-requests/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          resolutionNotes: resolutionText.trim() || "Resolved on-site by staff.",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setHelpRequests((prev) =>
          prev.map((r) => (r.id === selectedTicket.id ? json.data : r))
        );
        setSelectedTicket(null);
        setResolutionText("");
        toast.success("Help request marked as resolved!");
      } else {
        toast.error("Failed to resolve ticket");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setUpdatingTicket(false);
    }
  }

  // Filtered roster for search
  const filteredRoster = useMemo(() => {
    if (!search.trim()) return roster;
    const q = search.toLowerCase().trim();
    return roster.filter(
      (t) =>
        t.teamName.toLowerCase().includes(q) ||
        t.teamId.toLowerCase().includes(q) ||
        (t.desk && (t.desk.roomName.toLowerCase().includes(q) || String(t.desk.deskNumber).includes(q))) ||
        (t.college && t.college.toLowerCase().includes(q))
    );
  }, [roster, search]);

  // Venue room-by-room aggregation
  const roomsMap = useMemo(() => {
    const map = new Map<string, { total: number; checkedIn: number }>();
    roster.forEach((t) => {
      const room = t.desk?.roomName || "Unassigned";
      const current = map.get(room) || { total: 0, checkedIn: 0 };
      current.total++;
      if (t.isCheckedIn) current.checkedIn++;
      map.set(room, current);
    });
    return Array.from(map.entries());
  }, [roster]);

  // Filtered help requests
  const filteredHelp = useMemo(() => {
    if (helpFilter === "URGENT") {
      return helpRequests.filter((r) => r.priority === "URGENT" || r.priority === "HIGH");
    }
    if (helpFilter === "ACTIVE") {
      return helpRequests.filter((r) => r.status !== "RESOLVED" && r.status !== "CLOSED");
    }
    if (helpFilter === "RESOLVED") {
      return helpRequests.filter((r) => r.status === "RESOLVED");
    }
    return helpRequests;
  }, [helpRequests, helpFilter]);

  const unresolvedCount = helpRequests.filter((r) => r.status !== "RESOLVED").length;

  return (
    <div className={styles.container}>
      {/* 1. APP HEADER */}
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <span className={styles.roleBadge}>STAFF OPERATIONS</span>
          <span className={styles.personalBadge}>⚡ Scanned: {personalScans}</span>
        </div>
        <h1 className={styles.title}>{event.title}</h1>
      </header>

      {/* 2. APP NAVIGATION (DESKTOP & TABLET) */}
      <nav className={styles.appNav}>
        <button
          type="button"
          className={`${styles.navBtn} ${activeTab === "home" ? styles.navBtnActive : ""}`}
          onClick={() => setActiveTab("home")}
        >
          📊 Operations Hub
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${activeTab === "scan" ? styles.navBtnActive : ""}`}
          onClick={() => setActiveTab("scan")}
        >
          📷 Camera Scanner
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${activeTab === "roster" ? styles.navBtnActive : ""}`}
          onClick={() => setActiveTab("roster")}
        >
          👥 Roster & Manual Check-in ({roster.length})
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${activeTab === "desks" ? styles.navBtnActive : ""}`}
          onClick={() => setActiveTab("desks")}
        >
          🏢 Venue Rooms & Desks
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${activeTab === "help" ? styles.navBtnActive : ""}`}
          onClick={() => setActiveTab("help")}
        >
          🆘 Help Requests
          {unresolvedCount > 0 && (
            <span style={{ background: "#ef4444", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontSize: "10px", fontWeight: 800 }}>
              {unresolvedCount}
            </span>
          )}
        </button>
      </nav>

      {/* ============================================================
          TAB 1: OPERATIONS HUB / HOME
          ============================================================ */}
      {activeTab === "home" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          {/* KPI Stats Grid */}
          <div className={styles.statsBar}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Checked In</span>
              <span className={styles.statValue} style={{ color: "#34d399" }}>
                {stats.checkedIn}
              </span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Pending</span>
              <span className={styles.statValue} style={{ color: "#fbbf24" }}>
                {stats.pending}
              </span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Total Teams</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Attendance Rate</span>
              <span className={styles.statValue}>{stats.rate.toFixed(0)}%</span>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-sm)" }}>
            <button
              type="button"
              className={styles.card}
              onClick={() => setActiveTab("scan")}
              style={{ padding: "var(--spacing-md)", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "4px" }}>📷</div>
              <h3 style={{ fontSize: "15px", margin: "0 0 2px" }}>Open Optical Scanner</h3>
              <p style={{ fontSize: "12px", color: "var(--color-ink-muted)", margin: 0 }}>
                Scan participant QR passes at physical entry gates.
              </p>
            </button>

            <button
              type="button"
              className={styles.card}
              onClick={() => setActiveTab("help")}
              style={{ padding: "var(--spacing-md)", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "4px" }}>🆘</div>
              <h3 style={{ fontSize: "15px", margin: "0 0 2px" }}>
                Active Help Desk ({unresolvedCount})
              </h3>
              <p style={{ fontSize: "12px", color: "var(--color-ink-muted)", margin: 0 }}>
                Dispatch staff to participant desks requiring assistance.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 2: CAMERA SCANNER
          ============================================================ */}
      {activeTab === "scan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.scannerWrapper}>
            <div id="coordinator-qr-reader" className={styles.scannerViewport} />

            {/* High-Contrast Desk Allotment Result Overlay */}
            {scanResult && (
              <div
                className={`${styles.resultBanner} ${
                  scanResult.status === "success"
                    ? styles.resultSuccess
                    : scanResult.status === "warning"
                    ? styles.resultWarning
                    : styles.resultError
                }`}
              >
                <div className={styles.resultStatusText}>{scanResult.message}</div>

                {scanResult.teamName && (
                  <div className={styles.resultTeamName}>{scanResult.teamName}</div>
                )}

                {scanResult.deskNumber ? (
                  <div className={styles.deskAllotmentPill}>
                    📍 ROOM: {scanResult.roomName} · DESK: #{scanResult.deskNumber}
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "4px" }}>
                    No Desk Assigned Yet
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className={styles.dismissBtn}
                >
                  Scan Next Badge ❯
                </button>
              </div>
            )}
          </div>

          <p className={styles.scannerHint}>
            Point camera at the participant&apos;s phone screen or printed Universal QR badge.
          </p>
        </div>
      )}

      {/* ============================================================
          TAB 3: TEAMS ROSTER & MANUAL FALLBACK
          ============================================================ */}
      {activeTab === "roster" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <input
            type="text"
            placeholder="Search by team name, room, or desk number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />

          <div className={styles.rosterList}>
            {filteredRoster.map((t) => (
              <div key={t.teamId} className={styles.rosterCard}>
                <div className={styles.rosterCardHeader}>
                  <div>
                    <h3 className={styles.rosterTeamName}>{t.teamName}</h3>
                    <div className={styles.rosterMeta}>
                      <span>{t.memberCount} Members</span>
                      {t.college && <span>· {t.college}</span>}
                      {t.desk ? (
                        <span className={styles.rosterDeskTag}>
                          📍 {t.desk.roomName} · Desk #{t.desk.deskNumber}
                        </span>
                      ) : (
                        <span style={{ color: "#fbbf24", fontSize: "11px" }}>⚠️ No Desk</span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`${styles.checkInStatus} ${
                      t.isCheckedIn ? styles.statusCheckedIn : styles.statusPending
                    }`}
                  >
                    {t.isCheckedIn ? "✓ Checked In" : "Pending"}
                  </span>
                </div>

                {!t.isCheckedIn && (
                  <div className={styles.rosterCardFooter}>
                    <button
                      type="button"
                      disabled={processingManualId === t.teamId}
                      onClick={() => handleManualCheckIn(t.teamId)}
                      className={styles.manualCheckInBtn}
                    >
                      {processingManualId === t.teamId ? "Processing..." : "Manual Check-In ✍️"}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredRoster.length === 0 && (
              <div className={styles.emptyState}>
                <p>No teams found matching &quot;{search}&quot;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 4: VENUE ROOMS & DESKS
          ============================================================ */}
      {activeTab === "desks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.header}>
            <h2 className={styles.title}>🏢 Room Occupancy & Seating</h2>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: "4px 0 0" }}>
              Monitor check-in percentages room-by-room across venue halls.
            </p>
          </div>

          <div className={styles.roomGrid}>
            {roomsMap.map(([roomName, count]) => {
              const pct = count.total > 0 ? Math.round((count.checkedIn / count.total) * 100) : 0;
              return (
                <div key={roomName} className={styles.roomCard}>
                  <div className={styles.roomCardHeader}>
                    <h3 className={styles.roomName}>{roomName}</h3>
                    <span className={styles.roomCount}>
                      <strong>{count.checkedIn}</strong> / {count.total} Checked In
                    </span>
                  </div>

                  <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#10b981", borderRadius: "3px" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB 5: HELP REQUESTS FEED
          ============================================================ */}
      {activeTab === "help" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          {/* Filter Pills */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
            <button
              type="button"
              className={`${styles.navBtn} ${helpFilter === "ALL" ? styles.navBtnActive : ""}`}
              onClick={() => setHelpFilter("ALL")}
            >
              All ({helpRequests.length})
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${helpFilter === "ACTIVE" ? styles.navBtnActive : ""}`}
              onClick={() => setHelpFilter("ACTIVE")}
            >
              Active ({unresolvedCount})
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${helpFilter === "URGENT" ? styles.navBtnActive : ""}`}
              onClick={() => setHelpFilter("URGENT")}
            >
              🔥 Urgent / High
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${helpFilter === "RESOLVED" ? styles.navBtnActive : ""}`}
              onClick={() => setHelpFilter("RESOLVED")}
            >
              ✓ Resolved
            </button>
          </div>

          <div className={styles.ticketFeed}>
            {filteredHelp.map((req) => (
              <div key={req.id} className={styles.ticketCard}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketCategory}>
                    {CATEGORY_ICONS[req.category] || "❓"} {req.category.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`${styles.ticketPriority} ${
                      req.priority === "URGENT"
                        ? styles.prioUrgent
                        : req.priority === "HIGH"
                        ? styles.prioHigh
                        : styles.prioNormal
                    }`}
                  >
                    {req.priority}
                  </span>
                </div>

                <div className={styles.ticketTeam}>
                  {req.team?.name || "Participant Team"}
                </div>

                <div className={styles.ticketLocation}>
                  📍 {req.location || "General Venue Area"}
                </div>

                <p className={styles.ticketDesc}>{req.description}</p>

                <div className={styles.ticketFooter}>
                  <span className={styles.ticketTime}>
                    {req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                  </span>

                  <div className={styles.ticketActions}>
                    {req.status === "SUBMITTED" && (
                      <button
                        type="button"
                        onClick={() => handleClaimTicket(req.id)}
                        className={styles.claimBtn}
                      >
                        Claim Request 🙋
                      </button>
                    )}

                    {req.status === "IN_PROGRESS" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(req);
                          setResolutionText("");
                        }}
                        className={styles.resolveBtn}
                      >
                        Resolve Issue ✓
                      </button>
                    )}

                    {req.status === "RESOLVED" && (
                      <span className={styles.resolvedTag}>✓ Resolved</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredHelp.length === 0 && (
              <div className={styles.emptyState}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎉</div>
                <h4>No Help Requests Pending</h4>
                <p>All participant issues have been addressed.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. STICKY BOTTOM BAR (MOBILE) */}
      <div className={styles.bottomBar}>
        <button
          type="button"
          className={`${styles.bottomBarItem} ${activeTab === "home" ? styles.bottomBarActive : ""}`}
          onClick={() => setActiveTab("home")}
        >
          <span className={styles.bottomBarIcon}>📊</span>
          <span>Hub</span>
        </button>
        <button
          type="button"
          className={`${styles.bottomBarItem} ${activeTab === "scan" ? styles.bottomBarActive : ""}`}
          onClick={() => setActiveTab("scan")}
        >
          <span className={styles.bottomBarIcon}>📷</span>
          <span>Scan</span>
        </button>
        <button
          type="button"
          className={`${styles.bottomBarItem} ${activeTab === "roster" ? styles.bottomBarActive : ""}`}
          onClick={() => setActiveTab("roster")}
        >
          <span className={styles.bottomBarIcon}>👥</span>
          <span>Roster</span>
        </button>
        <button
          type="button"
          className={`${styles.bottomBarItem} ${activeTab === "desks" ? styles.bottomBarActive : ""}`}
          onClick={() => setActiveTab("desks")}
        >
          <span className={styles.bottomBarIcon}>🏢</span>
          <span>Desks</span>
        </button>
        <button
          type="button"
          className={`${styles.bottomBarItem} ${activeTab === "help" ? styles.bottomBarActive : ""}`}
          onClick={() => setActiveTab("help")}
        >
          <span className={styles.bottomBarIcon}>🆘</span>
          <span>Help</span>
          {unresolvedCount > 0 && (
            <span style={{ position: "absolute", top: "2px", right: "12px", background: "#ef4444", color: "#fff", width: "8px", height: "8px", borderRadius: "50%" }} />
          )}
        </button>
      </div>

      {/* Resolution Notes Modal */}
      {selectedTicket && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTicket(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Resolve Help Request</h3>
            <p className={styles.modalSub}>
              Team: <strong>{selectedTicket.team?.name}</strong> · Location: <strong>{selectedTicket.location}</strong>
            </p>

            <div className={styles.modalField}>
              <label>Resolution Action / Remarks</label>
              <textarea
                rows={3}
                required
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="e.g. Delivered power extension cord to desk, resolved Wi-Fi credentials..."
                className={styles.modalTextarea}
              />
            </div>

            <div className={styles.modalBtns}>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className={styles.modalCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingTicket}
                onClick={handleResolveTicket}
                className={styles.modalConfirm}
              >
                {updatingTicket ? "Saving..." : "Mark as Resolved ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
