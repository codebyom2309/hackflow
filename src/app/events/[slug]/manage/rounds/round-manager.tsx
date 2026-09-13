"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./rounds.module.css";
import { useToast, ConfirmModal } from "@/components/ui";

interface ProblemStatement {
  id: string;
  title: string;
  description: string;
  track?: string;
  attachmentUrl?: string;
}

interface Criterion {
  id?: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number;
  displayOrder?: number;
}

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
  retainDesks?: boolean | null;
  problemStatements?: any;
}

interface RoundManagerProps {
  slug: string;
  initialRounds?: RoundInfo[];
}

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
  SUBMISSION_LOCKED: "🔒 Submissions Locked",
  JUDGING: "⚖️ Judging in Progress",
  RESULTS_PENDING: "⏳ Results Pending",
  RESULTS_PUBLISHED: "📢 Results Published",
};

export default function RoundManager({ slug, initialRounds = [] }: RoundManagerProps) {
  const toast = useToast();
  const [rounds, setRounds] = useState<RoundInfo[]>(initialRounds);
  const [loading, setLoading] = useState(false);
  const [showNewRound, setShowNewRound] = useState(false);
  const [newRoundTitle, setNewRoundTitle] = useState("");
  const [activeTabs, setActiveTabs] = useState<Record<string, "overview" | "problems" | "rubric">>({});

  // Criteria cache per round
  const [criteriaMap, setCriteriaMap] = useState<Record<string, Criterion[]>>({});
  const [loadingCriteria, setLoadingCriteria] = useState<Record<string, boolean>>({});

  // New criterion draft per round
  const [newCriterion, setNewCriterion] = useState<Record<string, { name: string; description: string; maxPoints: number; weight: number }>>({});

  // New problem statement draft per round
  const [newProblem, setNewProblem] = useState<Record<string, { title: string; track: string; description: string; attachmentUrl: string }>>({});

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

  const refreshRounds = useCallback(async () => {
    const res = await fetch(`/api/events/${slug}/rounds`);
    if (res.ok) {
      const json = await res.json();
      setRounds(json.data || []);
    }
  }, [slug]);

  useEffect(() => {
    if (rounds.length === 0) {
      refreshRounds();
    }
  }, [refreshRounds, rounds.length]);

  // Fetch criteria when user opens rubric tab
  const fetchCriteriaForRound = useCallback(async (roundId: string) => {
    setLoadingCriteria((prev) => ({ ...prev, [roundId]: true }));
    try {
      const res = await fetch(`/api/events/${slug}/rounds/${roundId}/criteria`);
      if (res.ok) {
        const json = await res.json();
        setCriteriaMap((prev) => ({ ...prev, [roundId]: json.data || [] }));
      }
    } catch {
      toast.error("Failed to load evaluation criteria");
    } finally {
      setLoadingCriteria((prev) => ({ ...prev, [roundId]: false }));
    }
  }, [slug, toast]);

  const setTab = (roundId: string, tab: "overview" | "problems" | "rubric") => {
    setActiveTabs((prev) => ({ ...prev, [roundId]: tab }));
    if (tab === "rubric" && !criteriaMap[roundId]) {
      fetchCriteriaForRound(roundId);
    }
  };

  async function createRound() {
    if (loading) return;
    setLoading(true);
    const nextNum = rounds.length + 1;
    const res = await fetch(`/api/events/${slug}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundNumber: nextNum,
        title: newRoundTitle.trim() || `Round ${nextNum}`,
        retainDesks: true,
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(`Round ${nextNum} created successfully`);
      setNewRoundTitle("");
      setShowNewRound(false);
      await refreshRounds();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || "Failed to create round");
    }
  }

  async function transitionRound(roundId: string, newStatus: string) {
    if (loading) return;
    setLoading(true);
    const res = await fetch(`/api/events/${slug}/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(`Round updated to ${STATUS_LABELS[newStatus] || newStatus}`);
      await refreshRounds();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || "Transition failed");
    }
  }

  async function updateRoundConfig(roundId: string, patch: Partial<RoundInfo>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${slug}/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        toast.success("Round settings updated");
        await refreshRounds();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || "Failed to update round");
      }
    } catch {
      toast.error("Network error updating round");
    } finally {
      setLoading(false);
    }
  }

  // Add Problem Statement
  async function handleAddProblem(roundId: string) {
    const draft = newProblem[roundId];
    if (!draft || !draft.title.trim()) {
      toast.error("Problem statement title is required");
      return;
    }

    const currentRound = rounds.find((r) => r.id === roundId);
    const existingProblems = currentRound?.problemStatements || [];
    const updated = [
      ...existingProblems,
      {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        track: draft.track.trim() || undefined,
        description: draft.description.trim(),
        attachmentUrl: draft.attachmentUrl.trim() || undefined,
      },
    ];

    await updateRoundConfig(roundId, { problemStatements: updated });
    setNewProblem((prev) => ({
      ...prev,
      [roundId]: { title: "", track: "", description: "", attachmentUrl: "" },
    }));
  }

  // Remove Problem Statement
  async function handleRemoveProblem(roundId: string, problemId: string) {
    const currentRound = rounds.find((r) => r.id === roundId);
    const existingProblems: ProblemStatement[] = Array.isArray(currentRound?.problemStatements) ? currentRound.problemStatements : [];
    const updated = existingProblems.filter((p: ProblemStatement) => p.id !== problemId);
    await updateRoundConfig(roundId, { problemStatements: updated });
  }

  // Add Criterion
  async function handleAddCriterion(roundId: string) {
    const draft = newCriterion[roundId] || { name: "", description: "", maxPoints: 10, weight: 1 };
    if (!draft.name.trim()) {
      toast.error("Criterion name is required");
      return;
    }

    const newCrit: Criterion = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      maxPoints: Number(draft.maxPoints) || 10,
      weight: Number(draft.weight) || 1,
      displayOrder: (criteriaMap[roundId]?.length || 0) + 1,
    };

    const currentList = criteriaMap[roundId] || [];
    const updatedList = [...currentList, newCrit];

    try {
      const res = await fetch(`/api/events/${slug}/rounds/${roundId}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: updatedList }),
      });
      if (res.ok) {
        toast.success("Criterion added to rubric");
        setCriteriaMap((prev) => ({ ...prev, [roundId]: updatedList }));
        setNewCriterion((prev) => ({
          ...prev,
          [roundId]: { name: "", description: "", maxPoints: 10, weight: 1 },
        }));
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || "Failed to save criterion");
      }
    } catch {
      toast.error("Network error adding criterion");
    }
  }

  // Delete Criterion
  async function handleDeleteCriterion(roundId: string, index: number) {
    const currentList = criteriaMap[roundId] || [];
    const updatedList = currentList.filter((_, i) => i !== index);

    try {
      const res = await fetch(`/api/events/${slug}/rounds/${roundId}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: updatedList }),
      });
      if (res.ok) {
        toast.success("Criterion removed");
        setCriteriaMap((prev) => ({ ...prev, [roundId]: updatedList }));
      }
    } catch {
      toast.error("Failed to remove criterion");
    }
  }

  function computeShortlist(roundId: string) {
    let countVal = "10";
    setModalConfig({
      isOpen: true,
      title: "Compute Round Shortlist",
      message: "Specify the number of top-performing teams to advance to the next round.",
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
        const res = await fetch(`/api/events/${slug}/rounds/${roundId}/shortlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shortlistCount: count }),
        });
        setLoading(false);
        if (res.ok) {
          const json = await res.json();
          toast.success(`Shortlist generated: ${json.data.advancing} teams advancing, ${json.data.eliminated} eliminated`);
          await refreshRounds();
        } else {
          const json = await res.json().catch(() => ({}));
          toast.error(json.error || "Shortlist computation failed");
        }
      },
    });
  }

  function publishResults(roundId: string) {
    setModalConfig({
      isOpen: true,
      title: "Publish Round Results",
      message: "Are you sure you want to publish results for this round? This locks scores and updates team statuses on the live leaderboard.",
      confirmText: "Publish Results",
      isDanger: false,
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        setLoading(true);
        const res = await fetch(`/api/events/${slug}/rounds/${roundId}/shortlist/publish`, {
          method: "POST",
        });
        setLoading(false);
        if (res.ok) {
          toast.success("Round results published to live leaderboard!");
          await refreshRounds();
        } else {
          const json = await res.json().catch(() => ({}));
          toast.error(json.error || "Publishing failed");
        }
      },
    });
  }

  function getNextStatus(current: string): string | null {
    const idx = STATUS_ORDER.indexOf(current);
    return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rounds & Progression</h1>
          <p className={styles.subtitle}>
            Control submission windows, problem statements, evaluation rubrics, and automated team progression.
          </p>
        </div>
        <button onClick={() => setShowNewRound(!showNewRound)} className={styles.primaryBtn}>
          {showNewRound ? "✕ Cancel" : "+ New Round"}
        </button>
      </div>

      {showNewRound && (
        <div className={styles.formBox}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)" }}>
            Create Round {rounds.length + 1}
          </h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder={`e.g. Round ${rounds.length + 1}: Prototype Submission`}
              value={newRoundTitle}
              onChange={(e) => setNewRoundTitle(e.target.value)}
              className={styles.input}
              style={{ flex: 1, minWidth: 260 }}
            />
            <button onClick={createRound} disabled={loading} className={styles.primaryBtn}>
              {loading ? "Creating..." : "Save Round"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
        {rounds.map((r) => {
          const next = getNextStatus(r.status);
          const currentTab = activeTabs[r.id] || "overview";
          const currentCriteria = criteriaMap[r.id] || [];
          const totalPoints = currentCriteria.reduce((sum, c) => sum + (Number(c.maxPoints) || 0), 0);

          return (
            <div key={r.id} className={styles.roundCard}>
              <div className={styles.roundHeader}>
                <div className={styles.roundTitleArea}>
                  <h3 className={styles.roundTitle}>
                    Round {r.roundNumber}: {r.title || `Round ${r.roundNumber}`}
                  </h3>
                  <span className={`${styles.roundBadge} ${r.status !== "DRAFT" ? styles.roundBadgeActive : ""}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                <div className={styles.roundActions}>
                  <button
                    onClick={() => window.open(`/api/events/${slug}/rounds/${r.id}/matrix?format=csv`, "_blank")}
                    className={styles.secondaryBtn}
                  >
                    📊 Matrix CSV
                  </button>
                  {r.status === "RESULTS_PENDING" && (
                    <button
                      onClick={() => computeShortlist(r.id)}
                      disabled={loading}
                      className={styles.secondaryBtn}
                    >
                      🧮 Compute Shortlist
                    </button>
                  )}
                  {r.status === "RESULTS_PENDING" && (
                    <button
                      onClick={() => publishResults(r.id)}
                      disabled={loading}
                      className={styles.primaryBtn}
                    >
                      📢 Publish Results
                    </button>
                  )}
                  {next && (
                    <button
                      onClick={() => transitionRound(r.id, next)}
                      disabled={loading}
                      className={styles.transitionBtn}
                    >
                      Advance to: {STATUS_LABELS[next]?.split(" ").slice(1).join(" ") || next} →
                    </button>
                  )}
                  <select
                    value={r.status}
                    onChange={(e) => transitionRound(r.id, e.target.value)}
                    disabled={loading}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      borderRadius: "var(--rounded-pill)",
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--color-hairline)",
                      color: "var(--color-ink)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    title="Change stage manually"
                  >
                    {STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        Set Stage: {STATUS_LABELS[st] || st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Visual Round Progression Stepper */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                overflowX: "auto",
                padding: "8px 12px",
                background: "var(--color-surface-2)",
                borderRadius: "var(--rounded-lg)",
                border: "1px solid var(--color-hairline)",
              }}>
                {STATUS_ORDER.map((s, sIdx) => {
                  const currentIdx = STATUS_ORDER.indexOf(r.status);
                  const isPast = sIdx < currentIdx;
                  const isCurrent = s === r.status;
                  const label = STATUS_LABELS[s]?.split(" ").slice(1).join(" ") || s;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "var(--rounded-pill)",
                        background: isCurrent
                          ? "var(--color-accent)"
                          : isPast
                          ? "rgba(34, 197, 94, 0.15)"
                          : "transparent",
                        color: isCurrent
                          ? "#ffffff"
                          : isPast
                          ? "#15803d"
                          : "var(--color-ink-muted)",
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: "11px",
                        border: `1px solid ${isCurrent ? "var(--color-accent)" : isPast ? "rgba(34, 197, 94, 0.3)" : "transparent"}`,
                      }}>
                        <span>{isPast ? "✓" : sIdx + 1}.</span>
                        <span>{label}</span>
                      </div>
                      {sIdx < STATUS_ORDER.length - 1 && (
                        <span style={{ margin: "0 4px", color: "var(--color-hairline)", fontSize: "11px" }}>➔</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sub-tabs */}
              <div className={styles.innerTabs}>
                <button
                  className={`${styles.innerTabBtn} ${currentTab === "overview" ? styles.innerTabActive : ""}`}
                  onClick={() => setTab(r.id, "overview")}
                >
                  ⏱️ Overview & Deadlines
                </button>
                <button
                  className={`${styles.innerTabBtn} ${currentTab === "problems" ? styles.innerTabActive : ""}`}
                  onClick={() => setTab(r.id, "problems")}
                >
                  📜 Problem Statements ({r.problemStatements?.length || 0})
                </button>
                <button
                  className={`${styles.innerTabBtn} ${currentTab === "rubric" ? styles.innerTabActive : ""}`}
                  onClick={() => setTab(r.id, "rubric")}
                >
                  ⚖️ Evaluation Rubric ({currentCriteria.length})
                </button>
              </div>

              {/* TAB 1: OVERVIEW & DEADLINES */}
              {currentTab === "overview" && (
                <div className={styles.tabPanel}>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Submission Deadline</span>
                      <span className={styles.metaValue}>
                        {r.submissionDeadline ? new Date(r.submissionDeadline).toLocaleString() : "Not scheduled"}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Problem Statement Reveal</span>
                      <span className={styles.metaValue}>
                        {r.problemRevealAt ? new Date(r.problemRevealAt).toLocaleString() : "Revealed immediately"}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Advancing Shortlist</span>
                      <span className={styles.metaValue}>
                        {r.shortlistCount ? `Top ${r.shortlistCount} teams` : "All qualified"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.toggleRow}>
                    <div>
                      <div className={styles.toggleLabel}>Retain Desks for Round {r.roundNumber + 1}</div>
                      <div className={styles.toggleHint}>
                        Keep advancing teams at their current assigned desks when progressing past this round.
                      </div>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={r.retainDesks ?? true}
                        onChange={(e) => updateRoundConfig(r.id, { retainDesks: e.target.checked })}
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: PROBLEM STATEMENTS */}
              {currentTab === "problems" && (
                <div className={styles.tabPanel}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
                      {r.problemRevealAt
                        ? `Scheduled to reveal on ${new Date(r.problemRevealAt).toLocaleString()}`
                        : "Problem statements are currently visible to participants"}
                    </div>
                    <button
                      onClick={() => updateRoundConfig(r.id, { problemRevealAt: new Date().toISOString() })}
                      className={styles.secondaryBtn}
                      style={{ fontSize: 12 }}
                    >
                      🔓 Reveal Now to Participants
                    </button>
                  </div>

                  <div className={styles.problemsList}>
                    {(!r.problemStatements || r.problemStatements.length === 0) ? (
                      <div className={styles.emptyState}>
                        No problem statements added yet. Create the first challenge below.
                      </div>
                    ) : (
                      (r.problemStatements as ProblemStatement[]).map((prob: ProblemStatement) => (
                        <div key={prob.id} className={styles.problemCard}>
                          <div className={styles.problemHeader}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span className={styles.problemTitle}>{prob.title}</span>
                              {prob.track && <span className={styles.problemTrack}>{prob.track}</span>}
                            </div>
                            <button
                              onClick={() => handleRemoveProblem(r.id, prob.id)}
                              className={styles.dangerBtn}
                              style={{ padding: "4px 10px", fontSize: 12 }}
                            >
                              ✕ Delete
                            </button>
                          </div>
                          {prob.description && <p className={styles.problemDesc}>{prob.description}</p>}
                          {prob.attachmentUrl && (
                            <a
                              href={prob.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.problemAttachment}
                            >
                              📎 View Attached Spec / Resources →
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Problem Form */}
                  <div className={styles.formBox}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>
                      + Add Problem Statement
                    </h4>
                    <div className={styles.formGrid2}>
                      <input
                        type="text"
                        placeholder="Title (e.g. AI-Powered Medical Diagnosis Engine)"
                        value={newProblem[r.id]?.title || ""}
                        onChange={(e) =>
                          setNewProblem((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] || { title: "", track: "", description: "", attachmentUrl: "" }),
                              title: e.target.value,
                            },
                          }))
                        }
                        className={styles.input}
                      />
                      <input
                        type="text"
                        placeholder="Track / Category (e.g. Healthcare, Web3, FinTech)"
                        value={newProblem[r.id]?.track || ""}
                        onChange={(e) =>
                          setNewProblem((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] || { title: "", track: "", description: "", attachmentUrl: "" }),
                              track: e.target.value,
                            },
                          }))
                        }
                        className={styles.input}
                      />
                    </div>
                    <textarea
                      placeholder="Detailed problem description, objectives, and acceptance criteria..."
                      rows={3}
                      value={newProblem[r.id]?.description || ""}
                      onChange={(e) =>
                        setNewProblem((prev) => ({
                          ...prev,
                          [r.id]: {
                            ...(prev[r.id] || { title: "", track: "", description: "", attachmentUrl: "" }),
                            description: e.target.value,
                          },
                        }))
                      }
                      className={styles.textarea}
                    />
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="url"
                        placeholder="Resource / PDF URL (optional)"
                        value={newProblem[r.id]?.attachmentUrl || ""}
                        onChange={(e) =>
                          setNewProblem((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] || { title: "", track: "", description: "", attachmentUrl: "" }),
                              attachmentUrl: e.target.value,
                            },
                          }))
                        }
                        className={styles.input}
                        style={{ flex: 1, minWidth: 240 }}
                      />
                      <button
                        onClick={() => handleAddProblem(r.id)}
                        disabled={loading}
                        className={styles.primaryBtn}
                      >
                        Add Challenge
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EVALUATION RUBRIC */}
              {currentTab === "rubric" && (
                <div className={styles.tabPanel}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
                      Define criteria scored by judges. Scores are normalized across judges automatically.
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
                      Total Rubric Ceiling: <span style={{ color: "var(--color-accent, #6366f1)" }}>{totalPoints} pts</span>
                    </div>
                  </div>

                  {loadingCriteria[r.id] ? (
                    <div className={styles.emptyState}>Loading rubric...</div>
                  ) : currentCriteria.length === 0 ? (
                    <div className={styles.emptyState}>
                      No criteria defined yet. Add rubrics like Innovation, Technical Execution, or UI/UX below.
                    </div>
                  ) : (
                    <div className={styles.criteriaList}>
                      {currentCriteria.map((crit, idx) => (
                        <div key={crit.id || idx} className={styles.criteriaCard}>
                          <div className={styles.criteriaInfo}>
                            <div className={styles.criteriaName}>{crit.name}</div>
                            {crit.description && <div className={styles.criteriaDesc}>{crit.description}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className={styles.criteriaPoints}>Max: {crit.maxPoints} pts</span>
                            <button
                              onClick={() => handleDeleteCriterion(r.id, idx)}
                              className={styles.dangerBtn}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Criterion Form */}
                  <div className={styles.formBox}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>
                      + Add Evaluation Criterion
                    </h4>
                    <div className={styles.formGrid2}>
                      <input
                        type="text"
                        placeholder="Criterion Name (e.g. Technical Feasibility)"
                        value={newCriterion[r.id]?.name || ""}
                        onChange={(e) =>
                          setNewCriterion((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] || { name: "", description: "", maxPoints: 10, weight: 1 }),
                              name: e.target.value,
                            },
                          }))
                        }
                        className={styles.input}
                      />
                      <input
                        type="number"
                        placeholder="Max Points (e.g. 10 or 25)"
                        min={1}
                        max={100}
                        value={newCriterion[r.id]?.maxPoints ?? 10}
                        onChange={(e) =>
                          setNewCriterion((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] || { name: "", description: "", maxPoints: 10, weight: 1 }),
                              maxPoints: Number(e.target.value),
                            },
                          }))
                        }
                        className={styles.input}
                      />
                    </div>
                    <textarea
                      placeholder="Guidance for judges on how to assess this criterion..."
                      rows={2}
                      value={newCriterion[r.id]?.description || ""}
                      onChange={(e) =>
                        setNewCriterion((prev) => ({
                          ...prev,
                          [r.id]: {
                            ...(prev[r.id] || { name: "", description: "", maxPoints: 10, weight: 1 }),
                            description: e.target.value,
                          },
                        }))
                      }
                      className={styles.textarea}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleAddCriterion(r.id)}
                        disabled={loading}
                        className={styles.primaryBtn}
                      >
                        Add Criterion to Rubric
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {rounds.length === 0 && (
          <div className={styles.emptyState}>
            No rounds configured yet. Click <strong>+ New Round</strong> to create your first round.
          </div>
        )}
      </div>

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
