"use client";

import { useState, useEffect, use } from "react";

interface Ranking {
  rank: number;
  teamId: string;
  teamName: string;
  teamStatus: string;
  college: string;
  totalScore: number;
  isAdvancing: boolean;
}

interface RoundInfo {
  id: string;
  roundNumber: number;
  title: string | null;
}

export default function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(false);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<RoundInfo | null>(null);

  useEffect(() => {
    const url = selectedRoundId
      ? `/api/events/${slug}/results?roundId=${selectedRoundId}`
      : `/api/events/${slug}/results`;

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        setPublished(json.data?.published ?? false);
        setRankings(json.data?.rankings ?? []);
        setRounds(json.data?.rounds ?? []);
        setCurrentRound(json.data?.round ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, selectedRoundId]);

  const statusColors: Record<string, string> = {
    WINNER: "#fbbf24",
    FINALIST: "#c084fc",
    SHORTLISTED: "#a5b4fc",
    ACTIVE: "#4ade80",
    ELIMINATED: "rgba(255,255,255,0.25)",
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #09090f 0%, #0d0d1a 100%)",
      padding: "2rem 1rem",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#e0e0ff", margin: "0 0 0.25rem" }}>
          🏆 Results
        </h1>

        {loading ? (
          <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading results...</p>
        ) : !published ? (
          <div style={{
            textAlign: "center",
            padding: "4rem 2rem",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            marginTop: "2rem",
          }}>
            <div style={{ fontSize: 48, marginBottom: "1rem" }}>⏳</div>
            <h2 style={{ color: "#e0e0ff", fontSize: "1.2rem", margin: "0 0 0.5rem" }}>
              Results Not Yet Published
            </h2>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.9rem" }}>
              Results will appear here once the organizer publishes them. Stay tuned!
            </p>
          </div>
        ) : (
          <>
            {/* Round selector */}
            {rounds.length > 1 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <select
                  value={selectedRoundId || currentRound?.id || ""}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
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
                      Round {r.roundNumber}: {r.title || `Round ${r.roundNumber}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentRound && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Showing results for Round {currentRound.roundNumber}: {currentRound.title || `Round ${currentRound.roundNumber}`}
              </p>
            )}

            {/* Rankings table */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 120px 100px",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                background: "rgba(255,255,255,0.03)",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "rgba(255,255,255,0.3)",
              }}>
                <span>Rank</span>
                <span>Team</span>
                <span style={{ textAlign: "right" }}>Score</span>
                <span style={{ textAlign: "center" }}>Status</span>
              </div>

              {/* Rows */}
              {rankings.map((r) => (
                <div
                  key={r.teamId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 120px 100px",
                    gap: "0.5rem",
                    padding: "0.8rem 1rem",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    alignItems: "center",
                    background: r.rank <= 3 ? "rgba(251,191,36,0.03)" : "transparent",
                  }}
                >
                  <span style={{
                    fontSize: r.rank <= 3 ? "1.3rem" : "0.9rem",
                    fontWeight: 700,
                    color: r.rank <= 3 ? "#fbbf24" : "rgba(255,255,255,0.5)",
                  }}>
                    {rankBadge(r.rank)}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#e0e0ff", fontSize: "0.9rem" }}>
                      {r.teamName}
                    </div>
                    {r.college && (
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
                        {r.college}
                      </div>
                    )}
                  </div>
                  <span style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#e0e0ff",
                    fontSize: "1rem",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {Number(r.totalScore).toFixed(1)}
                  </span>
                  <span style={{
                    textAlign: "center",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "0.2rem 0.5rem",
                    borderRadius: 6,
                    background: `${statusColors[r.teamStatus] || "rgba(255,255,255,0.05)"}20`,
                    color: statusColors[r.teamStatus] || "rgba(255,255,255,0.5)",
                  }}>
                    {r.isAdvancing ? "✓ Advancing" : r.teamStatus.replace(/_/g, " ")}
                  </span>
                </div>
              ))}

              {rankings.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
                  No rankings available for this round.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
