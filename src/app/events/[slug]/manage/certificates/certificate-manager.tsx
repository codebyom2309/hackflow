"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import CertificateCanvasModal, { CertificateData } from "@/components/certificates/certificate-canvas-modal";
import { useToast, ConfirmModal } from "@/components/ui";

interface CertificateRecord {
  id: string;
  eventId: string;
  teamId: string;
  teamName: string | null;
  recipientName: string;
  recipientEmail: string | null;
  type: string;
  verificationCode: string;
  generatedAt: string | null;
  downloadedAt: string | null;
  createdAt: string | null;
}

export default function CertificateManager({
  slug,
  eventName = "Hackathon",
}: {
  slug: string;
  eventName?: string;
}) {
  const toast = useToast();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [feedback, setFeedback] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [activeCert, setActiveCert] = useState<CertificateData | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const fetchCertificates = useCallback(async () => {
    try {
      setFetching(true);
      const res = await fetch(`/api/events/${slug}/certificates`);
      if (res.ok) {
        const json = await res.json();
        setCertificates(json.data || []);
      }
    } catch {
      console.error("Failed to fetch certificates");
    } finally {
      setFetching(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  async function executeGenerate() {
    setConfirmGenerateOpen(false);
    setLoading(true);
    const res = await fetch(`/api/events/${slug}/certificates`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      const json = await res.json();
      const msg = `${json.data.total} certificates generated successfully`;
      setFeedback(`✅ ${msg}`);
      toast.success(msg);
      await fetchCertificates();
    } else {
      const json = await res.json().catch(() => ({}));
      const err = json.error || "Generation failed";
      setFeedback(`❌ ${err}`);
      toast.error(err);
    }
    setTimeout(() => setFeedback(""), 6000);
  }

  function generate() {
    setConfirmGenerateOpen(true);
  }

  // Summary counts
  const stats = useMemo(() => {
    return {
      total: certificates.length,
      winners: certificates.filter((c) => c.type === "WINNER").length,
      runnerUp: certificates.filter((c) => c.type === "RUNNER_UP").length,
      finalists: certificates.filter((c) => c.type === "FINALIST").length,
      participants: certificates.filter((c) => c.type === "PARTICIPANT").length,
      downloaded: certificates.filter((c) => c.downloadedAt !== null).length,
    };
  }, [certificates]);

  // Filtered certificates
  const filteredCerts = useMemo(() => {
    return certificates.filter((c) => {
      const matchesSearch =
        c.recipientName.toLowerCase().includes(search.toLowerCase()) ||
        (c.teamName && c.teamName.toLowerCase().includes(search.toLowerCase())) ||
        c.verificationCode.toLowerCase().includes(search.toLowerCase());

      const matchesType = filterType === "ALL" || c.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [certificates, search, filterType]);

  const badgeStyles: Record<string, { bg: string; color: string; border: string }> = {
    WINNER: { bg: "rgba(234, 179, 8, 0.15)", color: "#fde047", border: "rgba(234, 179, 8, 0.3)" },
    RUNNER_UP: { bg: "rgba(168, 85, 247, 0.15)", color: "#d8b4fe", border: "rgba(168, 85, 247, 0.3)" },
    FINALIST: { bg: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", border: "rgba(99, 102, 241, 0.3)" },
    PARTICIPANT: { bg: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7", border: "rgba(16, 185, 129, 0.3)" },
    SPECIAL: { bg: "rgba(244, 63, 94, 0.15)", color: "#fda4af", border: "rgba(244, 63, 94, 0.3)" },
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e0e0ff", margin: "0 0 0.25rem" }}>
        🎓 Certificate Management
      </h1>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Issue, preview, and download verified certificates for participants and winners.
      </p>

      {feedback && (
        <div style={{
          padding: "0.7rem 1rem",
          borderRadius: 10,
          marginBottom: "1.25rem",
          background: feedback.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${feedback.startsWith("✅") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          color: feedback.startsWith("✅") ? "#4ade80" : "#f87171",
          fontSize: "0.85rem",
        }}>
          {feedback}
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "white",
            border: "none",
            padding: "0.7rem 1.4rem",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
          }}
        >
          {loading ? "Generating..." : "🎓 Generate All Certificates"}
        </button>
        <a
          href={`/api/events/${slug}/export?type=certificates`}
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.7rem 1.3rem",
            background: "rgba(255,255,255,0.06)",
            color: "#c4b5fd",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          ⬇ Export CSV
        </a>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: "0.75rem",
        marginBottom: "2rem",
      }}>
        {[
          { label: "Total Issued", value: stats.total, color: "#e0e0ff" },
          { label: "Winners", value: stats.winners, color: "#fde047" },
          { label: "Runner-Up", value: stats.runnerUp, color: "#d8b4fe" },
          { label: "Finalists", value: stats.finalists, color: "#a5b4fc" },
          { label: "Participants", value: stats.participants, color: "#6ee7b7" },
          { label: "Downloaded", value: stats.downloaded, color: "#38bdf8" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: "1rem",
            textAlign: "center",
          }}>
            <span style={{ display: "block", fontSize: "1.6rem", fontWeight: 700, color: s.color, letterSpacing: "-0.5px" }}>
              {s.value}
            </span>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1rem",
        flexWrap: "wrap",
      }}>
        <input
          type="text"
          placeholder="Search by recipient, team, or verification code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 260,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "0.6rem 1rem",
            color: "#ffffff",
            fontSize: "0.85rem",
          }}
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            background: "rgba(20,24,35,0.9)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "0.6rem 0.9rem",
            color: "#e2e8f0",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          <option value="ALL">All Types ({certificates.length})</option>
          <option value="WINNER">Winners ({stats.winners})</option>
          <option value="RUNNER_UP">Runner-Up ({stats.runnerUp})</option>
          <option value="FINALIST">Finalists ({stats.finalists})</option>
          <option value="PARTICIPANT">Participants ({stats.participants})</option>
        </select>
      </div>

      {/* Certificate Table */}
      {fetching ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.3)" }}>
          Loading certificates...
        </div>
      ) : filteredCerts.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "3.5rem",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 14,
          border: "1px dashed rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.35)",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📜</div>
          {certificates.length === 0 ? (
            <>
              <h3 style={{ color: "#e2e8f0", margin: "0 0 0.5rem" }}>No certificates issued yet</h3>
              <p style={{ fontSize: "0.85rem" }}>Click "Generate All Certificates" above to issue verified certificates.</p>
            </>
          ) : (
            <p>No certificates match your search query or filter.</p>
          )}
        </div>
      ) : (
        <div style={{
          overflowX: "auto",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: "0.85rem 1rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Recipient</th>
                <th style={{ padding: "0.85rem 1rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Team</th>
                <th style={{ padding: "0.85rem 1rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Type</th>
                <th style={{ padding: "0.85rem 1rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Verification Code</th>
                <th style={{ padding: "0.85rem 1rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCerts.map((c) => {
                const bStyle = badgeStyles[c.type] || badgeStyles.PARTICIPANT;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "0.85rem 1rem", color: "#f8fafc", fontWeight: 600 }}>
                      {c.recipientName}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "rgba(255,255,255,0.6)" }}>
                      {c.teamName || "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "0.2rem 0.55rem",
                        borderRadius: 6,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: bStyle.bg,
                        color: bStyle.color,
                        border: `1px solid ${bStyle.border}`,
                      }}>
                        {c.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <a
                        href={`/verify/${c.verificationCode}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontFamily: "monospace",
                          color: "#93c5fd",
                          textDecoration: "none",
                          fontSize: "0.8rem",
                        }}
                      >
                        {c.verificationCode}
                      </a>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                      <button
                        onClick={() =>
                          setActiveCert({
                            id: c.id,
                            recipientName: c.recipientName,
                            teamName: c.teamName,
                            eventName,
                            type: c.type,
                            verificationCode: c.verificationCode,
                            generatedAt: c.generatedAt || c.createdAt,
                            eventSlug: slug,
                          })
                        }
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                          color: "#a5b4fc",
                          padding: "0.4rem 0.8rem",
                          borderRadius: 6,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        👁 View & Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Certificate Modal */}
      {activeCert && (
        <CertificateCanvasModal
          certificate={activeCert}
          onClose={() => setActiveCert(null)}
          eventSlug={slug}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmGenerateOpen}
        title="Generate All Certificates"
        message="Generate certificates for all teams in this event? This will refresh all verification codes and generate certificates for participants, winners, and runners-up."
        confirmText="Generate Certificates"
        onConfirm={executeGenerate}
        onCancel={() => setConfirmGenerateOpen(false)}
      />
    </div>
  );
}
