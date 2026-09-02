"use client";

import { useState, useCallback } from "react";
import styles from "./manage.module.css";

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

interface OrganizerDashboardProps {
  event: EventInfo;
  rounds: RoundInfo[];
}

type Tab = "overview" | "rounds" | "teams" | "judging" | "results" | "announcements" | "audit";

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

  const flash = useCallback((type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

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

  async function computeShortlist(roundId: string) {
    const count = prompt("Enter shortlist count (teams to advance):");
    if (!count) return;
    setLoading(true);
    const res = await fetch(`/api/events/${event.slug}/rounds/${roundId}/shortlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortlistCount: Number(count) }),
    });
    setLoading(false);
    if (res.ok) {
      const json = await res.json();
      flash("success", `Shortlist computed — ${json.data.advancing} advancing, ${json.data.eliminated} eliminated`);
    } else {
      const json = await res.json();
      flash("error", json.error || "Shortlist failed");
    }
  }

  async function publishResults(roundId: string) {
    if (!confirm("Publish results? This will update team statuses.")) return;
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
  async function generateCertificates() {
    if (!confirm("Generate certificates for all teams?")) return;
    setLoading(true);
    const res = await fetch(`/api/events/${event.slug}/certificates`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      const json = await res.json();
      flash("success", `${json.data.total} certificates generated (${json.data.winners} winners, ${json.data.runnerUp} runners-up)`);
    } else {
      flash("error", "Failed to generate certificates");
    }
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
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>🔄</span>
              <span className={styles.statNum}>{rounds.length}</span>
              <span className={styles.statLabel}>Rounds</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>⚖️</span>
              <span className={styles.statNum}>
                {rounds.filter((r) => r.status === "JUDGING").length}
              </span>
              <span className={styles.statLabel}>Active Judging</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>📢</span>
              <span className={styles.statNum}>
                {rounds.filter((r) => r.status === "RESULTS_PUBLISHED").length}
              </span>
              <span className={styles.statLabel}>Published</span>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Quick Actions</h3>
          <div className={styles.quickActions}>
            <a href={`/events/${event.slug}/venue`} className={styles.actionCard}>
              <span>🏢</span> Manage Venue
            </a>
            <a href={`/events/${event.slug}/coordinator`} className={styles.actionCard}>
              <span>📋</span> Coordinator View
            </a>
            <a href={`/events/${event.slug}/judge`} className={styles.actionCard}>
              <span>⚖️</span> Judge View
            </a>
            <button onClick={generateCertificates} className={styles.actionCard} disabled={loading}>
              <span>🎓</span> Generate Certificates
            </button>
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
    </div>
  );
}
