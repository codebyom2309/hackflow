"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./manage.module.css";
import { useToast, ConfirmModal } from "@/components/ui";

interface RoundInfo {
  id: string;
  roundNumber: number;
  title: string | null;
  status: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  problemRevealAt: Date | string | null;
  submissionDeadline: Date | string | null;
  shortlistCount: number | null;
}

interface EventInfo {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface DashboardStats {
  totalTeams: number;
  totalParticipants: number;
  statusCounts: Record<string, number>;
  checkedIn: number;
  checkInRate: number;
  activeRound: { id: string; roundNumber: number; title: string | null; status: string } | null;
  judgingTeams: number;
  totalScores: number;
  shortlisted: number;
  certificatesGenerated: number;
  judges: number;
  coordinators: number;
  rounds: number;
}

interface OrganizerDashboardProps {
  event: EventInfo;
  rounds: RoundInfo[];
}

type Tab = "overview" | "rounds" | "judging" | "results" | "announcements" | "audit";

const STATUS_ORDER = [
  "DRAFT",
  "SUBMISSION_OPEN",
  "SUBMISSION_LOCKED",
  "JUDGING",
  "RESULTS_PENDING",
  "RESULTS_PUBLISHED",
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "📝 Draft",
  SUBMISSION_OPEN: "📥 Submissions Open",
  SUBMISSION_LOCKED: "🔒 Locked",
  JUDGING: "⚖️ Judging",
  RESULTS_PENDING: "⏳ Results Pending",
  RESULTS_PUBLISHED: "📢 Published",
};

export default function OrganizerDashboard({ event, rounds: initialRounds }: OrganizerDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [rounds, setRounds] = useState(initialRounds);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // ========== Round Creation ==========
  const [showNewRound, setShowNewRound] = useState(false);
  const [newRoundTitle, setNewRoundTitle] = useState("");

  // ========== Announcement Creation ==========
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPriority, setAnnPriority] = useState("NORMAL");
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; content: string; priority: string; createdAt: string }>>([]);
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);

  // ========== Audit Logs ==========
  const [auditLogs, setAuditLogs] = useState<Array<{ action: string; entityType: string; createdAt: string }>>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);

  const toast = useToast();
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    inputConfig?: {
      label?: string;
      placeholder?: string;
      value: string;
      onChange: (val: string) => void;
      type?: string;
    };
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const flash = useCallback((type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
    setTimeout(() => setFeedback(null), 4000);
  }, [toast]);

  // Load live stats
  useEffect(() => {
    fetch(`/api/events/${event.slug}/stats`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setStats(json.data);
      })
      .catch(() => {});
  }, [event.slug]);

  async function refreshRounds() {
    const res = await fetch(`/api/events/${event.slug}/rounds`);
    if (res.ok) {
      const json = await res.json();
      setRounds(json.data);
    }
  }

  async function createRound() {
    setLoading(true);
    const nextNum = rounds.length + 1;
    const res = await fetch(`/api/events/${event.slug}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundNumber: nextNum, title: newRoundTitle || `Round ${nextNum}` }),
    });
    setLoading(false);
    if (res.ok) {
      flash("success", `Round ${nextNum} created`);
      setNewRoundTitle("");
      setShowNewRound(false);
      await refreshRounds();
    } else {
      const json = await res.json();
      flash("error", json.error || "Failed to create round");
    }
  }

  async function transitionRound(roundId: string, newStatus: string) {
    setLoading(true);
    const res = await fetch(`/api/events/${event.slug}/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      flash("success", `Round moved to ${STATUS_LABELS[newStatus] || newStatus}`);
      await refreshRounds();
    } else {
      const json = await res.json();
      flash("error", json.error || "Transition failed");
    }
  }

  function computeShortlist(roundId: string) {
    let countVal = "10";
    setModalConfig({
      isOpen: true,
      title: "Compute Round Shortlist",
      message: "Specify the number of top-performing teams to advance to the next stage.",
      confirmText: "Generate Shortlist",
      inputConfig: {
        label: "Number of Advancing Teams",
        placeholder: "10",
        value: countVal,
        type: "number",
        onChange: (val) => {
          countVal = val;
          setModalConfig((prev) => ({
            ...prev,
            inputConfig: prev.inputConfig ? { ...prev.inputConfig, value: val } : undefined,
          }));
        },
      },
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        const count = Number(countVal);
        if (!count || isNaN(count) || count <= 0) {
          toast.error("Please enter a valid positive number");
          return;
        }
        setLoading(true);
        const res = await fetch(`/api/events/${event.slug}/rounds/${roundId}/shortlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shortlistCount: count }),
        });
        setLoading(false);
        if (res.ok) {
          const json = await res.json();
          flash("success", `Shortlist computed — ${json.data.advancing} advancing, ${json.data.eliminated} eliminated`);
        } else {
          const json = await res.json();
          flash("error", json.error || "Shortlist failed");
        }
      },
    });
  }

  function publishResults(roundId: string) {
    setModalConfig({
      isOpen: true,
      title: "Publish Round Results",
      message: "Are you sure you want to publish results for this round? This will lock scores and update team statuses on the public leaderboard.",
      confirmText: "Publish Results",
      isDanger: false,
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        setLoading(true);
        const res = await fetch(`/api/events/${event.slug}/rounds/${roundId}/shortlist/publish`, {
          method: "POST",
        });
        setLoading(false);
        if (res.ok) {
          flash("success", "Results published!");
          await refreshRounds();
        } else {
          const json = await res.json();
          flash("error", json.error || "Publish failed");
        }
      },
    });
  }

  async function downloadMatrix(roundId: string) {
    window.open(`/api/events/${event.slug}/rounds/${roundId}/matrix?format=csv`, "_blank");
  }

  // ========== Announcements ==========
  async function loadAnnouncements() {
    const res = await fetch(`/api/events/${event.slug}/announcements`);
    if (res.ok) {
      const json = await res.json();
      setAnnouncements(json.data);
      setAnnouncementsLoaded(true);
    }
  }

  async function createAnnouncement() {
    if (!annTitle.trim() || !annContent.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/events/${event.slug}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: annTitle, content: annContent, priority: annPriority }),
    });
    setLoading(false);
    if (res.ok) {
      flash("success", "Announcement sent!");
      setAnnTitle("");
      setAnnContent("");
      await loadAnnouncements();
    }
  }

  // ========== Audit Logs ==========
  async function loadAudit() {
    const res = await fetch(`/api/events/${event.slug}/audit?limit=50`);
    if (res.ok) {
      const json = await res.json();
      setAuditLogs(json.data);
      setAuditLoaded(true);
    }
  }

  // ========== Certificates ==========
  function generateCertificates() {
    setModalConfig({
      isOpen: true,
      title: "Generate All Certificates",
      message: "Are you sure you want to generate verifiable certificates for all participating teams, winners, and runners-up?",
      confirmText: "Generate Certificates",
      isDanger: false,
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        setLoading(true);
        const res = await fetch(`/api/events/${event.slug}/certificates`, { method: "POST" });
        setLoading(false);
        if (res.ok) {
          const json = await res.json();
          flash("success", `${json.data.total} certificates generated (${json.data.winners} winners, ${json.data.runnerUp} runners-up)`);
        } else {
          flash("error", "Failed to generate certificates");
        }
      },
    });
  }

  function getNextStatus(current: string): string | null {
    const idx = STATUS_ORDER.indexOf(current);
    return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "rounds", label: "Rounds", icon: "🔄" },
    { key: "judging", label: "Judging", icon: "⚖️" },
    { key: "results", label: "Results", icon: "🏆" },
    { key: "announcements", label: "Announce", icon: "📢" },
    { key: "audit", label: "Audit", icon: "📋" },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{event.title}</h1>
          <p className={styles.subtitle}>Organizer Dashboard</p>
        </div>
        <span className={styles.statusBadge}>{event.status}</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`${styles.flash} ${feedback.type === "success" ? styles.flashSuccess : styles.flashError}`}>
          {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabRow}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabActive : ""}`}
            onClick={() => {
              setActiveTab(t.key);
              if (t.key === "announcements" && !announcementsLoaded) loadAnnouncements();
              if (t.key === "audit" && !auditLoaded) loadAudit();
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ======== OVERVIEW ======== */}
      {activeTab === "overview" && (
        <div className={styles.section}>
          {/* Live Stats Grid */}
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>👥</span>
              <span className={styles.statNum}>{stats?.totalTeams ?? "—"}</span>
              <span className={styles.statLabel}>Teams</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>🧑‍💻</span>
              <span className={styles.statNum}>{stats?.totalParticipants ?? "—"}</span>
              <span className={styles.statLabel}>Participants</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>✅</span>
              <span className={styles.statNum}>{stats?.checkedIn ?? "—"}</span>
              <span className={styles.statLabel}>Checked In ({stats?.checkInRate ?? 0}%)</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>🔄</span>
              <span className={styles.statNum}>{stats?.rounds ?? rounds.length}</span>
              <span className={styles.statLabel}>Rounds</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>⚖️</span>
              <span className={styles.statNum}>{stats?.judges ?? "—"}</span>
              <span className={styles.statLabel}>Judges</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>📋</span>
              <span className={styles.statNum}>{stats?.coordinators ?? "—"}</span>
              <span className={styles.statLabel}>Coordinators</span>
            </div>
          </div>

          {/* Active round highlight */}
          {stats?.activeRound && (
            <div className={styles.roundCard} style={{ marginBottom: "1.5rem" }}>
              <div className={styles.roundHeader}>
                <div>
                  <h4 className={styles.roundTitle}>
                    🔴 Active: Round {stats.activeRound.roundNumber} — {stats.activeRound.title || "Current Round"}
                  </h4>
                  <span className={`${styles.roundStatus}`}>
                    {STATUS_LABELS[stats.activeRound.status] || stats.activeRound.status}
                  </span>
                </div>
              </div>
              <div className={styles.roundMeta}>
                <span>⚖️ {stats.judgingTeams} teams scored ({stats.totalScores} total evaluations)</span>
                <span>🏅 {stats.shortlisted} teams shortlisted</span>
              </div>
            </div>
          )}

          {/* Status breakdown */}
          {stats?.statusCounts && Object.keys(stats.statusCounts).length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 className={styles.sectionTitle}>Team Status Breakdown</h3>
              <div className={styles.statusBreakdown}>
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status} className={styles.statusPillBadge}>
                    <span className={styles.statusPillCount}>{count}</span>
                    <span className={styles.statusPillText}>
                      {status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className={styles.sectionTitle}>Quick Actions</h3>
          <div className={styles.quickActions}>
            <a href={`/events/${event.slug}/manage/experience`} className={styles.actionCard}>
              <span>🎨</span> Experience Builder
            </a>
            <a href={`/events/${event.slug}/manage/help-desk`} className={styles.actionCard}>
              <span>🆘</span> Help Desk Queue
            </a>
            <a href={`/events/${event.slug}/manage/import`} className={styles.actionCard}>
              <span>📥</span> Import Registrations
            </a>
            <a href={`/events/${event.slug}/manage/teams`} className={styles.actionCard}>
              <span>👥</span> Manage Teams
            </a>
            <a href={`/events/${event.slug}/manage/venue`} className={styles.actionCard}>
              <span>🏢</span> Manage Venue
            </a>
            <a href={`/events/${event.slug}/coordinator`} className={styles.actionCard}>
              <span>📋</span> Coordinator View
            </a>
            <a href={`/events/${event.slug}/judge`} className={styles.actionCard}>
              <span>⚖️</span> Judge View
            </a>
            <a href={`/events/${event.slug}/results`} className={styles.actionCard}>
              <span>🏆</span> Public Results
            </a>
            <button onClick={generateCertificates} className={styles.actionCard} disabled={loading}>
              <span>🎓</span> Generate Certificates
            </button>
            <a
              href={`/api/events/${event.slug}/export?type=teams`}
              download
              className={styles.actionCard}
            >
              <span>⬇️</span> Export Teams CSV
            </a>
          </div>
        </div>
      )}

      {/* ======== ROUNDS ======== */}
      {activeTab === "rounds" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Round Management</h3>
            <button onClick={() => setShowNewRound(!showNewRound)} className={styles.primaryBtn}>
              + New Round
            </button>
          </div>

          {showNewRound && (
            <div className={styles.createForm}>
              <input
                type="text"
                placeholder="Round title (optional)"
                value={newRoundTitle}
                onChange={(e) => setNewRoundTitle(e.target.value)}
                className={styles.input}
              />
              <button onClick={createRound} disabled={loading} className={styles.primaryBtn}>
                {loading ? "Creating..." : "Create Round"}
              </button>
            </div>
          )}

          <div className={styles.roundsList}>
            {rounds.map((r) => {
              const next = getNextStatus(r.status);
              return (
                <div key={r.id} className={styles.roundCard}>
                  <div className={styles.roundHeader}>
                    <div>
                      <h4 className={styles.roundTitle}>
                        Round {r.roundNumber}: {r.title || `Round ${r.roundNumber}`}
                      </h4>
                      <span className={`${styles.roundStatus} ${styles[`status${r.status.replace(/_/g, "")}`] || ""}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                    {next && (
                      <button
                        onClick={() => transitionRound(r.id, next)}
                        disabled={loading}
                        className={styles.transitionBtn}
                      >
                        → {STATUS_LABELS[next]?.split(" ").slice(1).join(" ") || next}
                      </button>
                    )}
                  </div>

                  <div className={styles.roundMeta}>
                    {r.submissionDeadline && (
                      <span>⏰ Deadline: {new Date(r.submissionDeadline).toLocaleString()}</span>
                    )}
                    {r.problemRevealAt && (
                      <span>📜 Reveal: {new Date(r.problemRevealAt).toLocaleString()}</span>
                    )}
                    {r.shortlistCount && <span>👥 Shortlist: top {r.shortlistCount}</span>}
                  </div>
                </div>
              );
            })}

            {rounds.length === 0 && (
              <div className={styles.emptyState}>
                <p>No rounds yet. Create your first round to begin.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== JUDGING ======== */}
      {activeTab === "judging" && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Judging Control</h3>
          {rounds.filter((r) => ["JUDGING", "RESULTS_PENDING", "RESULTS_PUBLISHED"].includes(r.status)).length === 0 ? (
            <div className={styles.emptyState}>
              <p>No rounds in judging phase yet. Advance a round to JUDGING to start.</p>
            </div>
          ) : (
            rounds
              .filter((r) => ["JUDGING", "RESULTS_PENDING", "RESULTS_PUBLISHED"].includes(r.status))
              .map((r) => (
                <div key={r.id} className={styles.roundCard}>
                  <h4 className={styles.roundTitle}>
                    Round {r.roundNumber} — {STATUS_LABELS[r.status]}
                  </h4>
                  <div className={styles.judgingActions}>
                    <button onClick={() => downloadMatrix(r.id)} className={styles.secondaryBtn}>
                      📊 Export Scoring Matrix (CSV)
                    </button>
                    {r.status === "RESULTS_PENDING" && (
                      <>
                        <button onClick={() => computeShortlist(r.id)} disabled={loading} className={styles.secondaryBtn}>
                          🧮 Compute Shortlist
                        </button>
                        <button onClick={() => publishResults(r.id)} disabled={loading} className={styles.primaryBtn}>
                          📢 Publish Results
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ======== RESULTS ======== */}
      {activeTab === "results" && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Results & Certificates</h3>
          <div className={styles.quickActions}>
            <button onClick={generateCertificates} disabled={loading} className={styles.actionCard}>
              <span>🎓</span> Generate All Certificates
            </button>
            <a
              href={`/api/events/${event.slug}/export?type=results`}
              download
              className={styles.actionCard}
              style={{ textDecoration: "none" }}
            >
              <span>⬇️</span> Export Results CSV
            </a>
            <a
              href={`/api/events/${event.slug}/export?type=certificates`}
              download
              className={styles.actionCard}
              style={{ textDecoration: "none" }}
            >
              <span>📜</span> Export Certificates CSV
            </a>
            <a
              href={`/events/${event.slug}/results`}
              className={styles.actionCard}
              style={{ textDecoration: "none" }}
            >
              <span>🏆</span> Public Results Page
            </a>
          </div>
          {rounds
            .filter((r) => r.status === "RESULTS_PUBLISHED")
            .map((r) => (
              <div key={r.id} className={styles.roundCard}>
                <h4 className={styles.roundTitle}>Round {r.roundNumber} — Published ✅</h4>
                <button onClick={() => downloadMatrix(r.id)} className={styles.secondaryBtn}>
                  📊 Download Scoring CSV
                </button>
              </div>
            ))}
          {rounds.filter((r) => r.status === "RESULTS_PUBLISHED").length === 0 && (
            <div className={styles.emptyState}><p>No results published yet.</p></div>
          )}
        </div>
      )}

      {/* ======== ANNOUNCEMENTS ======== */}
      {activeTab === "announcements" && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Announcements</h3>
          <div className={styles.createForm}>
            <input
              type="text"
              placeholder="Announcement title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className={styles.input}
            />
            <textarea
              placeholder="Announcement content..."
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              className={styles.textarea}
              rows={3}
            />
            <div className={styles.formRow}>
              <select value={annPriority} onChange={(e) => setAnnPriority(e.target.value)} className={styles.select}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">🚨 Urgent</option>
              </select>
              <button onClick={createAnnouncement} disabled={loading || !annTitle.trim()} className={styles.primaryBtn}>
                Send Announcement
              </button>
            </div>
          </div>

          <div className={styles.listSection}>
            {announcements.map((a) => (
              <div key={a.id} className={`${styles.annCard} ${a.priority === "URGENT" ? styles.annUrgent : ""}`}>
                <div className={styles.annHeader}>
                  <strong>{a.title}</strong>
                  <span className={styles.annTime}>{new Date(a.createdAt).toLocaleString()}</span>
                </div>
                <p className={styles.annContent}>{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======== AUDIT ======== */}
      {activeTab === "audit" && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Audit Log</h3>
          <div className={styles.auditList}>
            {auditLogs.map((log, idx) => (
              <div key={idx} className={styles.auditRow}>
                <span className={styles.auditAction}>{log.action}</span>
                <span className={styles.auditEntity}>{log.entityType}</span>
                <span className={styles.auditTime}>{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {auditLoaded && auditLogs.length === 0 && (
              <div className={styles.emptyState}><p>No audit logs yet.</p></div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation & Prompt Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        isDanger={modalConfig.isDanger}
        inputConfig={modalConfig.inputConfig}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
