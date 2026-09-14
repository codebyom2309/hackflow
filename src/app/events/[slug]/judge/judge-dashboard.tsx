"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./judge.module.css";
import { useToast } from "@/components/ui/Toast";

interface RoundInfo {
  id: string;
  roundNumber: number;
  title: string | null;
  status: string;
}

interface RosterItem {
  teamId: string;
  teamName: string;
  memberCount: number;
  status: string;
  isCheckedIn: boolean;
  desk: { deskNumber: number; roomName: string } | null;
  projectName?: string | null;
  projectDescription?: string | null;
  githubUrl?: string | null;
  demoUrl?: string | null;
  pptUrl?: string | null;
  problemStatement?: string | null;
  college?: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  slug: string;
}

interface JudgeDashboardProps {
  event: EventInfo;
  rounds: RoundInfo[];
  roster: RosterItem[];
  assignedTeamIds: string[] | null;
}

export default function JudgeDashboard({
  event,
  rounds,
  roster,
  assignedTeamIds,
}: JudgeDashboardProps) {
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "evaluated" | "scan">("pending");
  const [selectedRound, setSelectedRound] = useState<RoundInfo | null>(
    rounds.find((r) => r.status === "JUDGING") || rounds[0] || null
  );

  const [evaluatedIds, setEvaluatedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ total: 0, evaluated: 0, rate: 0 });
  const [activeRoomContext, setActiveRoomContext] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Evaluation Sheet state
  const [evalSheet, setEvalSheet] = useState<{
    teamId: string;
    teamName: string;
    deskInfo?: string | null;
    project?: {
      title?: string | null;
      description?: string | null;
      githubUrl?: string | null;
      demoUrl?: string | null;
      pptUrl?: string | null;
      problemStatement?: string | null;
      college?: string | null;
    };
    criteria: Array<{
      id: string;
      name: string;
      description?: string | null;
      maxPoints: number;
      weight: string | number;
      score: number;
    }>;
    generalComment: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [undoMeta, setUndoMeta] = useState<{
    teamId: string;
    teamName: string;
    roundId: string;
    scoresPayload: any;
    timer: NodeJS.Timeout | null;
    secondsLeft: number;
  } | null>(null);

  const isScanningRef = useRef(false);
  const scannerRef = useRef<unknown>(null);

  // Filter roster by assignments if present
  const baseRoster = useMemo(() => {
    const list = Array.isArray(roster) ? roster : [];
    return assignedTeamIds !== null
      ? list.filter((t) => assignedTeamIds.includes(t.teamId))
      : list;
  }, [assignedTeamIds, roster]);

  // Refresh judge progress
  const refreshProgress = useCallback(async () => {
    if (!selectedRound) return;
    try {
      const res = await fetch(
        `/api/events/${event.slug}/judgments/progress/${selectedRound.id}`
      );
      if (res.ok) {
        const json = await res.json();
        setProgress(json.data);
        setEvaluatedIds(new Set(json.data.evaluatedTeamIds || []));
      }
    } catch {
      console.error("Failed to refresh judge progress");
    }
  }, [event.slug, selectedRound]);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  // Load criteria schema and open scoring sheet with project info
  const openEvaluationSheet = useCallback(
    async (team: RosterItem | { id: string; name: string; desk?: { deskNumber: number; roomName: string } | null; [key: string]: any }) => {
      if (!selectedRound) return;

      const teamId = (team as any).teamId || (team as any).id;
      const teamName = (team as any).teamName || (team as any).name;

      // Track active physical room for smart sorting
      if (team.desk?.roomName) {
        setActiveRoomContext(team.desk.roomName);
      }

      // Check if team info has project data, else find in baseRoster
      const fullTeam = baseRoster.find((t) => t.teamId === teamId) || team;

      try {
        const res = await fetch(
          `/api/events/${event.slug}/rounds/${selectedRound.id}/criteria`
        );
        if (!res.ok) {
          toast.error("Failed to load scoring criteria for this round");
          return;
        }

        const json = await res.json();
        const criteria = (json.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || null,
          maxPoints: c.maxPoints || 10,
          weight: c.weight || 1,
          score: Math.round((c.maxPoints || 10) * 0.5), // 50% default
        }));

        setEvalSheet({
          teamId,
          teamName,
          deskInfo: fullTeam.desk ? `${fullTeam.desk.roomName} — Desk #${fullTeam.desk.deskNumber}` : null,
          project: {
            title: fullTeam.projectName || fullTeam.problemStatement || null,
            description: fullTeam.projectDescription || null,
            githubUrl: fullTeam.githubUrl || null,
            demoUrl: fullTeam.demoUrl || null,
            pptUrl: fullTeam.pptUrl || null,
            problemStatement: fullTeam.problemStatement || null,
            college: fullTeam.college || null,
          },
          criteria,
          generalComment: "",
        });
      } catch {
        toast.error("Network error while loading criteria");
      }
    },
    [baseRoster, event.slug, selectedRound, toast]
  );

  // QR scan handler
  const handleScan = useCallback(
    async (payload: string) => {
      if (isScanningRef.current || !selectedRound) return;
      isScanningRef.current = true;

      try {
        const res = await fetch(`/api/events/${event.slug}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const json = await res.json();

        if (res.ok) {
          const team = json.data?.team;
          if (!team) {
            toast.error("Scanned QR is not associated with a team");
            return;
          }

          if (evaluatedIds.has(team.id)) {
            toast.warning(`Team ${team.name} has already been evaluated by you!`);
            return;
          }

          openEvaluationSheet(team);
        } else {
          toast.error(json.error || "Invalid QR pass");
        }
      } catch {
        toast.error("Scan error");
      } finally {
        setTimeout(() => {
          isScanningRef.current = false;
        }, 1500);
      }
    },
    [event.slug, selectedRound, evaluatedIds, openEvaluationSheet, toast]
  );

  // Initialize camera scanner when scan tab is active
  useEffect(() => {
    let html5QrCode: any = null;

    if (activeFilter === "scan" && !evalSheet) {
      import("html5-qrcode")
        .then(({ Html5Qrcode }) => {
          html5QrCode = new Html5Qrcode("judge-qr-reader");
          scannerRef.current = html5QrCode;

          html5QrCode
            .start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText: string) => handleScan(decodedText),
              () => {} // silent scan frame
            )
            .catch(() => {
              toast.error("Camera access failed or unavailable");
            });
        })
        .catch(() => {
          toast.error("Failed to load camera scanner");
        });
    }

    return () => {
      if (scannerRef.current) {
        try {
          (scannerRef.current as any).stop().catch(() => {});
        } catch {
          // ignore
        }
      }
    };
  }, [activeFilter, evalSheet, handleScan, toast]);

  // Intelligent room-aware sorting + search filtering
  const sortedRoster = useMemo(() => {
    let list = [...baseRoster];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.teamName?.toLowerCase().includes(q) ||
          t.teamId?.toLowerCase().includes(q) ||
          (t.desk && (t.desk.roomName?.toLowerCase().includes(q) || String(t.desk.deskNumber).includes(q))) ||
          (t.projectName && t.projectName.toLowerCase().includes(q))
      );
    }

    // Tab filter
    if (activeFilter === "pending") {
      list = list.filter((t) => !evaluatedIds.has(t.teamId));
    } else if (activeFilter === "evaluated") {
      list = list.filter((t) => evaluatedIds.has(t.teamId));
    }

    // Room-aware sorting: Prioritize pending teams in active room
    list.sort((a, b) => {
      const aEval = evaluatedIds.has(a.teamId) ? 1 : 0;
      const bEval = evaluatedIds.has(b.teamId) ? 1 : 0;

      // Un-evaluated first
      if (aEval !== bEval) return aEval - bEval;

      // Smart Sorting: Active physical room takes precedence
      if (activeRoomContext) {
        const aInRoom = a.desk?.roomName === activeRoomContext ? 1 : 0;
        const bInRoom = b.desk?.roomName === activeRoomContext ? 1 : 0;
        if (aInRoom !== bInRoom) return bInRoom - aInRoom;
      }

      // Check-in status
      if (a.isCheckedIn !== b.isCheckedIn) {
        return a.isCheckedIn ? -1 : 1;
      }

      // Desk order
      const aDesk = a.desk?.deskNumber ?? 9999;
      const bDesk = b.desk?.deskNumber ?? 9999;
      return aDesk - bDesk;
    });

    return list;
  }, [baseRoster, search, activeFilter, evaluatedIds, activeRoomContext]);

  // Calculate weighted total score
  const totalScore = useMemo(() => {
    if (!evalSheet) return 0;
    return evalSheet.criteria.reduce((sum, c) => {
      const w = Number(c.weight) || 1;
      return sum + c.score * w;
    }, 0);
  }, [evalSheet]);

  const maxTotalScore = useMemo(() => {
    if (!evalSheet) return 0;
    return evalSheet.criteria.reduce((sum, c) => {
      const w = Number(c.weight) || 1;
      return sum + c.maxPoints * w;
    }, 0);
  }, [evalSheet]);

  // Submit evaluation with idempotency and undo mechanism
  async function submitEvaluation() {
    if (!evalSheet || !selectedRound || submitting) return;

    setSubmitting(true);
    const idempotencyKey = `judge_${evalSheet.teamId}_${selectedRound.id}_${Date.now()}`;

    const payload = {
      roundId: selectedRound.id,
      teamId: evalSheet.teamId,
      scores: evalSheet.criteria.map((c) => ({
        criteriaId: c.id,
        score: c.score,
      })),
      generalComment: evalSheet.generalComment,
      idempotencyKey,
    };

    try {
      const res = await fetch(`/api/events/${event.slug}/judgments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Evaluation recorded for ${evalSheet.teamName}!`);
        setEvaluatedIds((prev) => new Set([...Array.from(prev), evalSheet.teamId]));
        refreshProgress();

        // 10-second safety undo window
        const timer = setTimeout(() => {
          setUndoMeta(null);
        }, 10000);

        setUndoMeta({
          teamId: evalSheet.teamId,
          teamName: evalSheet.teamName,
          roundId: selectedRound.id,
          scoresPayload: payload,
          timer,
          secondsLeft: 10,
        });

        setEvalSheet(null);
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to submit evaluation");
      }
    } catch {
      toast.error("Network error submitting evaluation");
    } finally {
      setSubmitting(false);
    }
  }

  // Undo submission
  async function handleUndo() {
    if (!undoMeta) return;
    if (undoMeta.timer) clearTimeout(undoMeta.timer);

    try {
      const res = await fetch(`/api/events/${event.slug}/judgments/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: undoMeta.teamId,
          roundId: undoMeta.roundId,
        }),
      });

      if (res.ok) {
        toast.info(`Evaluation undone for ${undoMeta.teamName}`);
        setEvaluatedIds((prev) => {
          const next = new Set(prev);
          next.delete(undoMeta.teamId);
          return next;
        });
        refreshProgress();
      }
    } catch {
      toast.error("Failed to undo evaluation");
    } finally {
      setUndoMeta(null);
    }
  }

  const pendingCount = baseRoster.length - evaluatedIds.size;

  return (
    <div className={styles.container}>
      {/* 1. APP HEADER */}
      <header className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.judgeBadge}>EVALUATION WORKSPACE</span>
            {activeRoomContext && (
              <span className={styles.roomContextBadge}>
                📍 Current Focus: {activeRoomContext}
              </span>
            )}
          </div>
          <h1 className={styles.title}>{event.title}</h1>
        </div>

        {rounds.length > 0 && (
          <div className={styles.roundSelector}>
            <label>Round:</label>
            <select
              value={selectedRound?.id || ""}
              onChange={(e) => {
                const found = rounds.find((r) => r.id === e.target.value);
                if (found) setSelectedRound(found);
              }}
              className={styles.roundSelect}
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  Round {r.roundNumber}: {r.title || "Evaluation"}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* 2. STATS KPI BAR */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Assigned Teams</span>
          <span className={styles.statValue}>{baseRoster.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Evaluated</span>
          <span className={styles.statValue} style={{ color: "#34d399" }}>
            {evaluatedIds.size}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Remaining</span>
          <span className={styles.statValue} style={{ color: "#fbbf24" }}>
            {Math.max(0, pendingCount)}
          </span>
        </div>
      </div>

      {/* 2.5. EVALUATION COMPLETION PROGRESS */}
      {baseRoster.length > 0 && (
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span>Evaluation Progress</span>
            <span className={styles.progressRate}>
              {Math.round((evaluatedIds.size / baseRoster.length) * 100)}% Complete
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{
                width: `${Math.min(100, Math.round((evaluatedIds.size / baseRoster.length) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 3. ROSTER FILTER TABS & SEARCH */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className={styles.rosterTabs}>
          <button
            type="button"
            className={`${styles.rosterTab} ${activeFilter === "pending" ? styles.rosterTabActive : ""}`}
            onClick={() => setActiveFilter("pending")}
          >
            ⏳ Pending ({Math.max(0, pendingCount)})
          </button>
          <button
            type="button"
            className={`${styles.rosterTab} ${activeFilter === "all" ? styles.rosterTabActive : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            📋 All Teams ({baseRoster.length})
          </button>
          <button
            type="button"
            className={`${styles.rosterTab} ${activeFilter === "evaluated" ? styles.rosterTabActive : ""}`}
            onClick={() => setActiveFilter("evaluated")}
          >
            ✅ Evaluated ({evaluatedIds.size})
          </button>
          <button
            type="button"
            className={`${styles.rosterTab} ${activeFilter === "scan" ? styles.rosterTabActive : ""}`}
            onClick={() => setActiveFilter("scan")}
          >
            📷 Quick Camera Scan
          </button>
        </div>

        {activeFilter !== "scan" && (
          <input
            type="text"
            placeholder="Search teams by name, ID, room, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        )}
      </div>

      {/* 4. CAMERA SCANNER TAB */}
      {activeFilter === "scan" && !evalSheet && (
        <div className={styles.scannerCard}>
          <div id="judge-qr-reader" className={styles.scannerViewport} />
          <p className={styles.scannerHint}>
            Point camera at the participant&apos;s Universal QR badge to immediately open their scoring sheet.
          </p>
        </div>
      )}

      {/* 5. TEAM ROSTER CARDS */}
      {activeFilter !== "scan" && !evalSheet && (
        <div className={styles.rosterList}>
          {sortedRoster.map((team) => {
            const isEvaluated = evaluatedIds.has(team.teamId);
            const inActiveRoom =
              activeRoomContext && team.desk?.roomName === activeRoomContext;

            return (
              <div
                key={team.teamId}
                className={`${styles.teamCard} ${isEvaluated ? styles.teamCardDone : ""} ${
                  inActiveRoom && !isEvaluated ? styles.teamCardActiveRoom : ""
                }`}
              >
                <div className={styles.teamHeader}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <h3 className={styles.teamName}>{team.teamName}</h3>
                      {inActiveRoom && !isEvaluated && (
                        <span className={styles.smartRoomPill}>
                          📍 In {activeRoomContext}
                        </span>
                      )}
                    </div>
                    <div className={styles.teamMeta}>
                      <span>{team.memberCount} Members</span>
                      {team.college && <span>· {team.college}</span>}
                      {team.desk && (
                        <span className={styles.deskTag}>
                          📍 {team.desk.roomName} (Desk #{team.desk.deskNumber})
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`${styles.evalStatus} ${
                      isEvaluated ? styles.evalDone : styles.evalPending
                    }`}
                  >
                    {isEvaluated ? "✓ Evaluated" : "Pending"}
                  </span>
                </div>

                {/* Project Teaser if available */}
                {(team.projectName || team.githubUrl) && (
                  <div style={{ fontSize: "12px", color: "var(--color-ink-muted)", margin: "4px 0" }}>
                    {team.projectName && <strong>Project: {team.projectName}</strong>}
                    {team.githubUrl && <span style={{ marginLeft: "8px", color: "#3b82f6" }}>🐙 GitHub Repo</span>}
                  </div>
                )}

                <div className={styles.teamFooter}>
                  <button
                    type="button"
                    onClick={() => openEvaluationSheet(team)}
                    className={styles.evalBtn}
                  >
                    {isEvaluated ? "Review / Re-score →" : "Evaluate Team ⚖️"}
                  </button>
                </div>
              </div>
            );
          })}

          {sortedRoster.length === 0 && (
            <div className={styles.emptyCard}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚖️</div>
              <h4>No Teams Match Filter</h4>
              <p>Try clearing your search or switching filter tabs above.</p>
            </div>
          )}
        </div>
      )}

      {/* 6. EVALUATION WORKSPACE MODAL / DRAWER */}
      {evalSheet && (
        <div className={styles.evalOverlay} onClick={() => setEvalSheet(null)}>
          <div className={styles.evalDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.evalHeader}>
            <div>
              <span className={styles.evalHeaderBadge}>
                {selectedRound?.title || `Round ${selectedRound?.roundNumber}`} Scoring
              </span>
              <h2 className={styles.evalTeamTitle}>{evalSheet.teamName}</h2>
              {evalSheet.deskInfo && (
                <div className={styles.evalDeskInfo}>📍 {evalSheet.deskInfo}</div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEvalSheet(null)}
              className={styles.closeBtn}
            >
              ✕
            </button>
          </div>

          {/* Project Details Panel */}
          {evalSheet.project && (
            <div className={styles.projectInfoBox}>
              {evalSheet.project.title && (
                <h4 className={styles.projectTitle}>
                  💡 {evalSheet.project.title}
                </h4>
              )}
              {evalSheet.project.description && (
                <p className={styles.projectDesc}>
                  {evalSheet.project.description}
                </p>
              )}

              <div className={styles.projectLinksRow}>
                {evalSheet.project.githubUrl && (
                  <a
                    href={evalSheet.project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.projectLinkChip}
                  >
                    🐙 GitHub Repository ↗
                  </a>
                )}
                {evalSheet.project.demoUrl && (
                  <a
                    href={evalSheet.project.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.projectLinkChip}
                  >
                    🌐 Live Demo / Video ↗
                  </a>
                )}
                {evalSheet.project.pptUrl && (
                  <a
                    href={evalSheet.project.pptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.projectLinkChip}
                  >
                    📊 Presentation Slides ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Criteria Scoring Form */}
          <div className={styles.criteriaList}>
            {evalSheet.criteria.map((c, idx) => {
              const isBinary = c.maxPoints === 1;
              const isSmall = c.maxPoints <= 5 && !isBinary;

              return (
                <div key={c.id} className={styles.criteriaCard}>
                  <div className={styles.criteriaHeader}>
                    <div>
                      <h4 className={styles.criteriaName}>{c.name}</h4>
                      {c.description && (
                        <p className={styles.criteriaDesc}>{c.description}</p>
                      )}
                    </div>
                    <span className={styles.criteriaScoreDisplay}>
                      <strong>{c.score}</strong> / {c.maxPoints} pts
                    </span>
                  </div>

                  {/* Input Type 1: Binary Yes/No */}
                  {isBinary && (
                    <div className={styles.quickScoreRow}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...evalSheet.criteria];
                          next[idx].score = 0;
                          setEvalSheet({ ...evalSheet, criteria: next });
                        }}
                        className={`${styles.scoreBtn} ${c.score === 0 ? styles.scoreBtnActive : ""}`}
                      >
                        No (0)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...evalSheet.criteria];
                          next[idx].score = 1;
                          setEvalSheet({ ...evalSheet, criteria: next });
                        }}
                        className={`${styles.scoreBtn} ${c.score === 1 ? styles.scoreBtnActive : ""}`}
                      >
                        Yes (1)
                      </button>
                    </div>
                  )}

                  {/* Input Type 2: Quick-tap buttons (<= 5 points) */}
                  {isSmall && (
                    <div className={styles.quickScoreRow}>
                      {Array.from({ length: c.maxPoints + 1 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const next = [...evalSheet.criteria];
                            next[idx].score = i;
                            setEvalSheet({ ...evalSheet, criteria: next });
                          }}
                          className={`${styles.scoreBtn} ${c.score === i ? styles.scoreBtnActive : ""}`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input Type 3: Stepper + Slider (> 5 points) */}
                  {!isBinary && !isSmall && (
                    <div className={styles.stepperWrapper}>
                      <button
                        type="button"
                        disabled={c.score <= 0}
                        onClick={() => {
                          const next = [...evalSheet.criteria];
                          next[idx].score = Math.max(0, c.score - 1);
                          setEvalSheet({ ...evalSheet, criteria: next });
                        }}
                        className={styles.stepperBtn}
                      >
                        -
                      </button>

                      <input
                        type="range"
                        min="0"
                        max={c.maxPoints}
                        value={c.score}
                        onChange={(e) => {
                          const next = [...evalSheet.criteria];
                          next[idx].score = Number(e.target.value);
                          setEvalSheet({ ...evalSheet, criteria: next });
                        }}
                        className={styles.slider}
                        style={{ flex: 1 }}
                      />

                      <button
                        type="button"
                        disabled={c.score >= c.maxPoints}
                        onClick={() => {
                          const next = [...evalSheet.criteria];
                          next[idx].score = Math.min(c.maxPoints, c.score + 1);
                          setEvalSheet({ ...evalSheet, criteria: next });
                        }}
                        className={styles.stepperBtn}
                      >
                        +
                      </button>

                      <span className={styles.stepperValue}>{c.score}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* General Feedback Comments */}
            <div className={styles.commentCard}>
              <label>Judge Remarks & Feedback (Optional):</label>
              <textarea
                rows={3}
                value={evalSheet.generalComment}
                onChange={(e) =>
                  setEvalSheet({ ...evalSheet, generalComment: e.target.value })
                }
                placeholder="Key strengths, architectural critique, areas to improve..."
                className={styles.commentInput}
              />
            </div>
          </div>

          {/* Sticky Submit Bar */}
          <div className={styles.stickySubmitBar}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--color-ink-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Total Weighted Score
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-ink)" }}>
                {totalScore.toFixed(1)} / {maxTotalScore}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setEvalSheet(null)}
                className={styles.cancelEvalBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitEvaluation}
                className={styles.submitEvalBtn}
              >
                {submitting ? "Submitting..." : "Submit Evaluation 🚀"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* 6. MOBILE STICKY BOTTOM BAR */}
      {!evalSheet && (
        <div className={styles.bottomBar}>
          <button
            type="button"
            className={`${styles.bottomBarItem} ${activeFilter === "pending" ? styles.bottomBarActive : ""}`}
            onClick={() => setActiveFilter("pending")}
          >
            <span className={styles.bottomBarIcon}>⏳</span>
            <span>Pending ({Math.max(0, pendingCount)})</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomBarItem} ${activeFilter === "all" ? styles.bottomBarActive : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            <span className={styles.bottomBarIcon}>📋</span>
            <span>All ({baseRoster.length})</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomBarItem} ${activeFilter === "evaluated" ? styles.bottomBarActive : ""}`}
            onClick={() => setActiveFilter("evaluated")}
          >
            <span className={styles.bottomBarIcon}>✅</span>
            <span>Done ({evaluatedIds.size})</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomBarItem} ${activeFilter === "scan" ? styles.bottomBarActive : ""}`}
            onClick={() => setActiveFilter("scan")}
          >
            <span className={styles.bottomBarIcon}>📷</span>
            <span>Scan QR</span>
          </button>
        </div>
      )}

      {/* Safety Undo Toast Window */}
      {undoMeta && (
        <div className={styles.undoToast}>
          <span>✓ Evaluation saved for {undoMeta.teamName}</span>
          <button type="button" onClick={handleUndo} className={styles.undoBtn}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
