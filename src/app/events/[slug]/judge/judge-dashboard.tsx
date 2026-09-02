"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./judge.module.css";

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
}

export default function JudgeDashboard({ event, rounds, roster }: JudgeDashboardProps) {
  const [activeTab, setActiveTab] = useState<"scan" | "roster">("scan");
  const [selectedRound, setSelectedRound] = useState<RoundInfo | null>(
    rounds.find((r) => r.status === "JUDGING") || rounds[0] || null
  );
  const [scanning, setScanning] = useState(false);
  const [evaluatedIds, setEvaluatedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ total: 0, evaluated: 0, rate: 0 });
  const [scanResult, setScanResult] = useState<{
    status: "success" | "error" | "warning";
    message: string;
    teamName?: string;
  } | null>(null);
  const [evalSheet, setEvalSheet] = useState<{
    teamId: string;
    teamName: string;
    criteria: Array<{ id: string; name: string; maxPoints: number; score: number }>;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const isScanningRef = useRef(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSubmitMeta, setLastSubmitMeta] = useState<{
    teamId: string;
    roundId: string;
    canUndo: boolean;
  } | null>(null);

  // Load criteria for selected round
  const loadCriteria = useCallback(async (teamId: string, teamName: string) => {
    if (!selectedRound) return;
    try {
      const res = await fetch(
        `/api/events/${event.slug}/rounds/${selectedRound.id}/criteria`
      );
      if (!res.ok) return;
      const json = await res.json();
      const criteria = (json.data || []).map((c: { id: string; name: string; maxPoints: number }) => ({
        id: c.id,
        name: c.name,
        maxPoints: c.maxPoints,
        score: Math.round(c.maxPoints * 0.5), // Default 50%
      }));
      setEvalSheet({ teamId, teamName, criteria });
    } catch {
      console.error("Failed to load criteria");
    }
  }, [event.slug, selectedRound]);

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
      console.error("Failed to refresh progress");
    }
  }, [event.slug, selectedRound]);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

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
            setScanResult({ status: "error", message: "Team not found" });
            return;
          }
          if (evaluatedIds.has(team.id)) {
            setScanResult({
              status: "warning",
              message: "Already evaluated this team",
              teamName: team.name,
            });
            return;
          }
          setScanResult({ status: "success", message: "Team found!", teamName: team.name });
          await loadCriteria(team.id, team.name);
        } else {
          setScanResult({ status: "error", message: json.error || "Invalid QR" });
        }
      } catch {
        setScanResult({ status: "error", message: "Network error" });
      } finally {
        setTimeout(() => { isScanningRef.current = false; }, 2000);
      }
    },
    [event.slug, selectedRound, evaluatedIds, loadCriteria]
  );

  // Camera scanner
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let html5QrCode: any = null;
    if (activeTab === "scan" && scanning) {
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        const el = document.getElementById("judge-qr-reader");
        if (!el) return;
        html5QrCode = new Html5Qrcode("judge-qr-reader");
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          handleScan,
          () => {}
        ).catch(() => setScanning(false));
      });
    }
    return () => {
      if (html5QrCode) {
        try {
          html5QrCode.stop().then(() => html5QrCode.clear());
        } catch { /* cleanup */ }
      }
    };
  }, [activeTab, scanning, handleScan]);

  // Update score in eval sheet
  function setScore(criteriaId: string, score: number) {
    setEvalSheet((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        criteria: prev.criteria.map((c) =>
          c.id === criteriaId ? { ...c, score } : c
        ),
      };
    });
  }

  // Submit evaluation
  async function submitEvaluation() {
    if (!evalSheet || !selectedRound) return;
    setSubmitting(true);
    const idempotencyKey = `${evalSheet.teamId}-${selectedRound.id}-${Date.now()}`;

    try {
      const res = await fetch(`/api/events/${event.slug}/judgments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: evalSheet.teamId,
          roundId: selectedRound.id,
          scores: evalSheet.criteria.map((c) => ({ criteriaId: c.id, score: c.score })),
          idempotencyKey,
        }),
      });

      if (res.ok) {
        setLastSubmitMeta({ teamId: evalSheet.teamId, roundId: selectedRound.id, canUndo: true });
        setEvalSheet(null);
        setScanResult(null);
        await refreshProgress();

        // Undo window: 10 seconds
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => {
          setLastSubmitMeta((prev) => prev ? { ...prev, canUndo: false } : null);
        }, 10000);
      } else {
        const json = await res.json();
        alert(json.error || "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Undo judgment
  async function handleUndo() {
    if (!lastSubmitMeta || !lastSubmitMeta.canUndo) return;
    const res = await fetch(`/api/events/${event.slug}/judgments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: lastSubmitMeta.teamId, roundId: lastSubmitMeta.roundId }),
    });
    if (res.ok) {
      setLastSubmitMeta(null);
      await refreshProgress();
    }
  }

  const filteredRoster = roster.filter(
    (t) =>
      !evaluatedIds.has(t.teamId) || activeTab === "roster"
        ? t.teamName.toLowerCase().includes(search.toLowerCase())
        : false
  );

  const judgingRound = selectedRound?.status === "JUDGING";

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Judge Dashboard</h1>
          <p className={styles.subtitle}>{event.title}</p>
        </div>

        {/* Round selector */}
        <select
          className={styles.roundSelect}
          value={selectedRound?.id || ""}
          onChange={(e) => {
            const r = rounds.find((r) => r.id === e.target.value);
            setSelectedRound(r || null);
          }}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              Round {r.roundNumber}: {r.title || `Round ${r.roundNumber}`} — {r.status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Progress Bar */}
      <div className={styles.statsCard}>
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{progress.total}</span>
            <span className={styles.statLabel}>Teams</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.valGreen}`}>{progress.evaluated}</span>
            <span className={styles.statLabel}>Evaluated</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.valYellow}`}>{progress.total - progress.evaluated}</span>
            <span className={styles.statLabel}>Remaining</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{Math.round(progress.rate)}%</span>
            <span className={styles.statLabel}>Progress</span>
          </div>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress.rate}%` }} />
        </div>
      </div>

      {!judgingRound && (
        <div className={styles.warningBanner}>
          ⚠ Selected round is not in JUDGING phase. Evaluation is not active.
        </div>
      )}

      {/* Undo Banner */}
      {lastSubmitMeta?.canUndo && (
        <div className={styles.undoBanner}>
          <span>Judgment submitted successfully!</span>
          <button onClick={handleUndo} className={styles.undoBtn}>↩ Undo (10s)</button>
        </div>
      )}

      {/* Evaluation Sheet Modal */}
      {evalSheet && (
        <div className={styles.evalOverlay}>
          <div className={styles.evalModal}>
            <div className={styles.evalHeader}>
              <h2 className={styles.evalTitle}>Evaluating: {evalSheet.teamName}</h2>
              <button onClick={() => setEvalSheet(null)} className={styles.evalClose}>✕</button>
            </div>

            <div className={styles.criteriaList}>
              {evalSheet.criteria.map((c) => (
                <div key={c.id} className={styles.criterionRow}>
                  <div className={styles.criterionInfo}>
                    <span className={styles.criterionName}>{c.name}</span>
                    <span className={styles.criterionMax}>/ {c.maxPoints}</span>
                  </div>

                  {c.maxPoints <= 5 ? (
                    // Quick-tap buttons
                    <div className={styles.quickTap}>
                      {Array.from({ length: c.maxPoints + 1 }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setScore(c.id, i)}
                          className={`${styles.tapBtn} ${c.score === i ? styles.tapBtnActive : ""}`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  ) : (
                    // Stepper
                    <div className={styles.stepper}>
                      <button
                        onClick={() => setScore(c.id, Math.max(0, c.score - 1))}
                        className={styles.stepBtn}
                      >−</button>
                      <span className={styles.stepVal}>{c.score}</span>
                      <button
                        onClick={() => setScore(c.id, Math.min(c.maxPoints, c.score + 1))}
                        className={styles.stepBtn}
                      >+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={submitEvaluation}
              disabled={submitting || !judgingRound}
              className={styles.submitBtn}
            >
              {submitting ? "Submitting..." : "Submit Evaluation"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === "scan" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("scan")}
        >📷 Scan Team QR</button>
        <button
          className={`${styles.tabBtn} ${activeTab === "roster" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("roster"); setScanning(false); }}
        >📋 Team Roster ({roster.length})</button>
      </div>

      {/* Scanner Tab */}
      {activeTab === "scan" && (
        <div className={styles.scanWrapper}>
          <div className={styles.scanCard}>
            <div className={styles.scanControls}>
              {!scanning ? (
                <button onClick={() => { setScanResult(null); setScanning(true); }} className={styles.startBtn}>
                  Start Camera Scanner
                </button>
              ) : (
                <button onClick={() => setScanning(false)} className={styles.stopBtn}>Stop Camera</button>
              )}
            </div>

            <div id="judge-qr-reader" className={styles.cameraBox}>
              {!scanning && (
                <div className={styles.cameraPlaceholder}>
                  <span style={{ fontSize: 48 }}>📷</span>
                  <p>Scan a participant QR pass to open evaluation sheet</p>
                </div>
              )}
            </div>

            {scanResult && (
              <div className={`${styles.feedback} ${
                scanResult.status === "success" ? styles.feedbackSuccess
                  : scanResult.status === "warning" ? styles.feedbackWarning
                  : styles.feedbackError
              }`}>
                <strong>{scanResult.status === "success" ? "✅" : scanResult.status === "warning" ? "⚠️" : "❌"}</strong>
                <span>{scanResult.message}{scanResult.teamName ? ` — ${scanResult.teamName}` : ""}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roster Tab */}
      {activeTab === "roster" && (
        <div className={styles.rosterWrapper}>
          <input
            type="text"
            placeholder="Search teams..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.rosterList}>
            {roster
              .filter((t) => t.teamName.toLowerCase().includes(search.toLowerCase()))
              .map((item) => {
                const isEvaluated = evaluatedIds.has(item.teamId);
                return (
                  <div key={item.teamId} className={styles.rosterRow}>
                    <div className={styles.rosterInfo}>
                      <span className={styles.rosterName}>{item.teamName}</span>
                      {item.desk && (
                        <span className={styles.rosterDesk}>
                          {item.desk.roomName} · Desk D{item.desk.deskNumber}
                        </span>
                      )}
                    </div>
                    <div className={styles.rosterActions}>
                      {isEvaluated ? (
                        <span className={styles.evaluatedBadge}>✓ Evaluated</span>
                      ) : (
                        <button
                          onClick={() => loadCriteria(item.teamId, item.teamName)}
                          disabled={!judgingRound}
                          className={styles.evalBtn}
                        >
                          Evaluate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
