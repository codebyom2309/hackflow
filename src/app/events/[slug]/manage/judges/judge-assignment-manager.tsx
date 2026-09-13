"use client";

import { useState, useEffect } from "react";
import { useToast, ConfirmModal } from "@/components/ui";

interface JudgeEntry {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  assignedTeams: number;
  teamIds: string[];
}

export default function JudgeAssignmentManager({ event }: { event: { id: string; slug: string } }) {
  const toast = useToast();
  const [rounds, setRounds] = useState<Array<{ id: string; roundNumber: number; title: string | null; status: string }>>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [matrix, setMatrix] = useState<JudgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${event.slug}/rounds`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setRounds(json.data);
          if (json.data.length > 0) setSelectedRound(json.data[json.data.length - 1].id);
        }
      });
  }, [event.slug]);

  useEffect(() => {
    if (!selectedRound) return;
    fetch(`/api/events/${event.slug}/judges?roundId=${selectedRound}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.matrix) setMatrix(json.data.matrix);
      });
  }, [event.slug, selectedRound]);

  async function executeAutoDistribute() {
    if (!selectedRound) return;
    setConfirmOpen(false);
    setLoading(true);
    const res = await fetch(`/api/events/${event.slug}/judges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "auto-distribute", roundId: selectedRound }),
    });
    setLoading(false);
    if (res.ok) {
      const json = await res.json();
      const msg = `${json.data.totalAssigned} teams distributed among ${json.data.judgeCount} judges`;
      setFeedback(`✅ ${msg}`);
      toast.success(msg);
      // Refresh matrix
      const matrixRes = await fetch(`/api/events/${event.slug}/judges?roundId=${selectedRound}`);
      const matrixJson = await matrixRes.json();
      if (matrixJson.data?.matrix) setMatrix(matrixJson.data.matrix);
    } else {
      const json = await res.json();
      const err = json.error || "Distribution failed";
      setFeedback(`❌ ${err}`);
      toast.error(err);
    }
    setTimeout(() => setFeedback(""), 4000);
  }

  function autoDistribute() {
    if (!selectedRound) {
      toast.warning("Please select a round first");
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e0e0ff", margin: "0 0 0.25rem" }}>
        ⚖️ Judge Assignments
      </h1>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Assign teams to judges per round. Auto-distribute for even allocation.
      </p>

      {feedback && (
        <div style={{
          padding: "0.7rem 1rem",
          borderRadius: 10,
          marginBottom: "1rem",
          background: feedback.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${feedback.startsWith("✅") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          color: feedback.startsWith("✅") ? "#4ade80" : "#f87171",
          fontSize: "0.85rem",
        }}>
          {feedback}
        </div>
      )}

      {/* Round selector */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" }}>
        <select
          value={selectedRound}
          onChange={(e) => setSelectedRound(e.target.value)}
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e0e0ff",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            fontSize: "0.85rem",
          }}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              Round {r.roundNumber}: {r.title || `Round ${r.roundNumber}`} ({r.status})
            </option>
          ))}
        </select>
        <button
          onClick={autoDistribute}
          disabled={loading || !selectedRound}
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "white",
            border: "none",
            padding: "0.55rem 1rem",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.8rem",
            cursor: "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          🔀 Auto-Distribute
        </button>
      </div>

      {/* Assignment matrix */}
      {matrix.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "3rem",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.3)",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚖️</div>
          <p>No judges assigned to this event yet.</p>
          <p style={{ fontSize: "0.8rem" }}>
            Invite judges via the Settings page, then use Auto-Distribute to assign teams.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {matrix.map((judge) => (
            <div
              key={judge.judgeId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.9rem 1rem",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10,
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: "0.9rem",
                flexShrink: 0,
              }}>
                {judge.judgeName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#e0e0ff", fontSize: "0.9rem" }}>
                  {judge.judgeName}
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                  {judge.judgeEmail}
                </div>
              </div>
              <div style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                padding: "0.3rem 0.75rem",
                borderRadius: 99,
                background: "rgba(99,102,241,0.15)",
                color: "#a5b4fc",
              }}>
                {judge.assignedTeams} teams
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        title="Auto-Distribute Teams"
        message="Auto-distribute teams evenly among judges for this round? This will clear existing assignments and balance the workload evenly."
        confirmText="Auto-Distribute"
        onConfirm={executeAutoDistribute}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
