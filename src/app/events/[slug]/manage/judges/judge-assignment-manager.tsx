"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast, ConfirmModal } from "@/components/ui";
import styles from "./judges.module.css";

interface JudgeItem {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  image: string | null;
  assignedTeamsCount: number;
  evaluatedTeamsCount: number;
  assignedTeamIds: string[];
  status: "COMPLETED" | "IN_PROGRESS" | "PENDING";
  createdAt: string;
}

interface CoordinatorItem {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  image: string | null;
  actionsCount: number;
  lastActiveAt: string;
  createdAt: string;
}

interface MatrixEntry {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  assignedTeams: number;
  teamIds: string[];
}

export default function JudgeAssignmentManager({
  event,
}: {
  event: { id: string; slug: string };
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"judges" | "coordinators" | "matrix">("judges");

  // Data lists
  const [judges, setJudges] = useState<JudgeItem[]>([]);
  const [coordinators, setCoordinators] = useState<CoordinatorItem[]>([]);
  const [matrix, setMatrix] = useState<MatrixEntry[]>([]);
  const [rounds, setRounds] = useState<Array<{ id: string; roundNumber: number; title: string | null }>>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Forms
  const [judgeName, setJudgeName] = useState("");
  const [judgeEmail, setJudgeEmail] = useState("");
  const [coordName, setCoordName] = useState("");
  const [coordEmail, setCoordEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; role: "JUDGE" | "COORDINATOR"; name: string } | null>(null);

  const fetchStaffData = useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedRound
        ? `/api/events/${event.slug}/judges?roundId=${selectedRound}`
        : `/api/events/${event.slug}/judges`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setJudges(json.data.judges || []);
          setCoordinators(json.data.coordinators || []);
          if (json.data.matrix) setMatrix(json.data.matrix);
        }
      }
    } catch {
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  }, [event.slug, selectedRound, toast]);

  useEffect(() => {
    // Fetch rounds
    fetch(`/api/events/${event.slug}/rounds`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          setRounds(json.data);
          setSelectedRound(json.data[json.data.length - 1].id);
        }
      });
  }, [event.slug]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  // Handle Add Judge
  async function handleAddJudge(e: React.FormEvent) {
    e.preventDefault();
    if (!judgeEmail.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/judges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-judge",
          email: judgeEmail.trim(),
          name: judgeName.trim(),
        }),
      });

      if (res.ok) {
        toast.success(`Judge authorized! They can now log in via Google using ${judgeEmail.trim()}`);
        setJudgeName("");
        setJudgeEmail("");
        fetchStaffData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add judge");
      }
    } catch {
      toast.error("Network error adding judge");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Add Coordinator
  async function handleAddCoordinator(e: React.FormEvent) {
    e.preventDefault();
    if (!coordEmail.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/judges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-coordinator",
          email: coordEmail.trim(),
          name: coordName.trim(),
        }),
      });

      if (res.ok) {
        toast.success(`Coordinator authorized! They can now log in using ${coordEmail.trim()}`);
        setCoordName("");
        setCoordEmail("");
        fetchStaffData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add coordinator");
      }
    } catch {
      toast.error("Network error adding coordinator");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Remove Staff
  async function executeRemove() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/events/${event.slug}/judges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove-member",
          userId: deleteTarget.userId,
          role: deleteTarget.role,
        }),
      });

      if (res.ok) {
        toast.success(`${deleteTarget.name} removed from ${deleteTarget.role.toLowerCase()}s`);
        fetchStaffData();
      } else {
        toast.error("Failed to remove staff member");
      }
    } catch {
      toast.error("Network error removing member");
    } finally {
      setDeleteTarget(null);
    }
  }

  // Handle Auto-Distribute
  async function handleAutoDistribute() {
    if (!selectedRound) {
      toast.warning("Please select a round first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/judges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-distribute", roundId: selectedRound }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`${json.data.totalAssigned} teams distributed among ${json.data.judgeCount} judges!`);
        fetchStaffData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Distribution failed");
      }
    } catch {
      toast.error("Network error during auto distribution");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>⚖️ Judges & Operations Staff</h1>
        <p className={styles.subtitle}>
          Authorize evaluating judges and operational coordinators by Google email. They will gain immediate role access upon sign-in.
        </p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "judges" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("judges")}
        >
          <span>⚖️ Evaluation Judges</span>
          <span className={styles.tabBadge}>{judges.length}</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === "coordinators" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("coordinators")}
        >
          <span>📱 Operations Coordinators</span>
          <span className={styles.tabBadge}>{coordinators.length}</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === "matrix" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          <span>📊 Auto-Distribution & Matrix</span>
        </button>
      </div>

      {/* TAB 1: JUDGES */}
      {activeTab === "judges" && (
        <div>
          {/* Add Judge Card */}
          <div className={styles.addCard}>
            <h3 className={styles.addCardTitle}>+ Authorize New Judge</h3>
            <p className={styles.addCardDesc}>
              Enter their Google account email. When they click <strong>&quot;Continue as Judge&quot;</strong>, they will be granted immediate access to the evaluation workspace.
            </p>
            <form onSubmit={handleAddJudge} className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Judge Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jane Doe"
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Google Account Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jane.doe@university.edu"
                  value={judgeEmail}
                  onChange={(e) => setJudgeEmail(e.target.value)}
                  className={styles.input}
                />
              </div>
              <button type="submit" disabled={submitting} className={styles.submitBtn}>
                {submitting ? "Authorizing..." : "Add Judge"}
              </button>
            </form>
          </div>

          {/* Judges List */}
          {judges.length > 0 ? (
            <div className={styles.rosterGrid}>
              {judges.map((j) => {
                const percent =
                  j.assignedTeamsCount > 0
                    ? Math.round((j.evaluatedTeamsCount / j.assignedTeamsCount) * 100)
                    : 0;

                return (
                  <div key={j.id} className={styles.memberCard}>
                    <div>
                      <div className={styles.memberHeader}>
                        <div className={styles.memberInfo}>
                          <div className={styles.avatar}>
                            {j.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className={styles.memberName}>{j.name}</h4>
                            <p className={styles.memberEmail}>{j.email}</p>
                          </div>
                        </div>
                        <span
                          className={`${styles.statusBadge} ${
                            j.status === "COMPLETED"
                              ? styles.statusCompleted
                              : j.status === "IN_PROGRESS"
                              ? styles.statusProgress
                              : styles.statusPending
                          }`}
                        >
                          {j.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className={styles.progressWrapper} style={{ marginTop: "14px" }}>
                        <div className={styles.progressLabel}>
                          <span>Evaluation Progress</span>
                          <span>
                            <strong>{j.evaluatedTeamsCount}</strong> / {j.assignedTeamsCount} teams ({percent}%)
                          </span>
                        </div>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.memberFooter}>
                      <span className={styles.metaText}>
                        Joined {new Date(j.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            userId: j.id,
                            role: "JUDGE",
                            name: j.name,
                          })
                        }
                        className={styles.removeBtn}
                      >
                        Remove Judge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>⚖️</div>
              <h4>No Judges Authorized Yet</h4>
              <p>Add your first evaluating judge using the form above.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COORDINATORS */}
      {activeTab === "coordinators" && (
        <div>
          {/* Add Coordinator Card */}
          <div className={styles.addCard}>
            <h3 className={styles.addCardTitle}>+ Authorize Operational Coordinator</h3>
            <p className={styles.addCardDesc}>
              Coordinators operate the optical QR camera scanner, check in teams at physical entrance gates, and handle on-site participant help requests.
            </p>
            <form onSubmit={handleAddCoordinator} className={styles.formRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Coordinator Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Chen"
                  value={coordName}
                  onChange={(e) => setCoordName(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Google Account Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@volunteer.org"
                  value={coordEmail}
                  onChange={(e) => setCoordEmail(e.target.value)}
                  className={styles.input}
                />
              </div>
              <button type="submit" disabled={submitting} className={styles.submitBtn}>
                {submitting ? "Authorizing..." : "Add Coordinator"}
              </button>
            </form>
          </div>

          {/* Coordinators List */}
          {coordinators.length > 0 ? (
            <div className={styles.rosterGrid}>
              {coordinators.map((c) => (
                <div key={c.id} className={styles.memberCard}>
                  <div className={styles.memberHeader}>
                    <div className={styles.memberInfo}>
                      <div className={styles.avatar} style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className={styles.memberName}>{c.name}</h4>
                        <p className={styles.memberEmail}>{c.email}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "var(--color-ink-muted)", marginTop: "8px" }}>
                    <div>⚡ Operations Handled: <strong>{c.actionsCount}</strong></div>
                    <div>🕒 Last Active: <strong>{c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleTimeString() : "Just now"}</strong></div>
                  </div>

                  <div className={styles.memberFooter}>
                    <span className={styles.metaText}>
                      Added {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          userId: c.id,
                          role: "COORDINATOR",
                          name: c.name,
                        })
                      }
                      className={styles.removeBtn}
                    >
                      Remove Staff
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📱</div>
              <h4>No Coordinators Authorized Yet</h4>
              <p>Add volunteers or operational coordinators to run attendance scanning.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MATRIX & AUTO-DISTRIBUTE */}
      {activeTab === "matrix" && (
        <div className={styles.matrixCard}>
          <div className={styles.roundBar}>
            <div className={styles.roundSelector}>
              <label className={styles.label}>Evaluation Round:</label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className={styles.select}
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    Round {r.roundNumber}: {r.title || "Evaluation"}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAutoDistribute}
              disabled={loading || judges.length === 0}
              className={styles.autoBtn}
            >
              🔄 Auto-Distribute Teams (Round-Robin)
            </button>
          </div>

          {matrix.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Judge</th>
                  <th className={styles.th}>Assigned Teams</th>
                  <th className={styles.th}>Allocation Status</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((m) => (
                  <tr key={m.judgeId}>
                    <td className={styles.td}>
                      <strong>{m.judgeName}</strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-ink-muted)" }}>{m.judgeEmail}</div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.tabBadge}>{m.assignedTeams} teams</span>
                    </td>
                    <td className={styles.td}>
                      <span style={{ color: m.assignedTeams > 0 ? "#4ade80" : "#94a3b8", fontSize: "0.8rem", fontWeight: 600 }}>
                        {m.assignedTeams > 0 ? "✓ Ready for Evaluation" : "⚠️ Needs Allocation"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyState}>
              <p>No team assignments recorded for this round yet. Click &quot;Auto-Distribute Teams&quot; above to allocate teams evenly among all authorized judges.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm Remove Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          title={`Remove ${deleteTarget.role}?`}
          message={`Are you sure you want to remove ${deleteTarget.name} (${deleteTarget.role}) from this event? They will no longer be able to access the ${deleteTarget.role.toLowerCase()} portal.`}
          confirmText="Yes, Remove"
          isDanger={true}
          onConfirm={executeRemove}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
