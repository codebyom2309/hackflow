"use client";

import { useState, useEffect, use } from "react";

export default function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    verified: boolean;
    data?: {
      recipientName: string;
      teamName: string;
      eventName: string;
      certificateType: string;
      issuedAt: string;
      verificationCode: string;
    };
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/verify/${code}`)
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        setResult({ verified: false, error: "Failed to verify" });
        setLoading(false);
      });
  }, [code]);

  const typeLabels: Record<string, string> = {
    PARTICIPANT: "Certificate of Participation",
    WINNER: "Winner Certificate",
    RUNNER_UP: "Runner-Up Certificate",
    FINALIST: "Finalist Certificate",
    SPECIAL: "Special Recognition",
    VOLUNTEER: "Volunteer Certificate",
    JUDGE: "Judge Certificate",
    COORDINATOR: "Coordinator Certificate",
  };

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a2a 100%)",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding: "1rem",
    }}>
      <div style={{
        maxWidth: 500,
        width: "100%",
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "2.5rem 2rem",
        textAlign: "center",
        color: "#e0e0e0",
      }}>
        {loading ? (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <p style={{ opacity: 0.7 }}>Verifying certificate...</p>
          </div>
        ) : result?.verified ? (
          <div>
            <div style={{
              width: 72, height: 72, margin: "0 auto 1.25rem",
              borderRadius: "50%",
              background: "rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36,
            }}>✅</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#22c55e", margin: "0 0 0.25rem" }}>
              Certificate Verified
            </h1>
            <p style={{ opacity: 0.5, fontSize: "0.85rem", margin: "0 0 1.5rem" }}>
              This is a valid HackFlow certificate
            </p>

            <div style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 12,
              padding: "1.25rem",
              textAlign: "left",
            }}>
              <Row label="Recipient" value={result.data!.recipientName} />
              <Row label="Team" value={result.data!.teamName} />
              <Row label="Event" value={result.data!.eventName} />
              <Row label="Certificate" value={typeLabels[result.data!.certificateType] || result.data!.certificateType} />
              <Row label="Issued" value={new Date(result.data!.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
              <Row label="Code" value={result.data!.verificationCode} mono />
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              width: 72, height: 72, margin: "0 auto 1.25rem",
              borderRadius: "50%",
              background: "rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36,
            }}>❌</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ef4444", margin: "0 0 0.5rem" }}>
              Verification Failed
            </h1>
            <p style={{ opacity: 0.6, fontSize: "0.9rem" }}>
              {result?.error || "This certificate code is invalid or does not exist."}
            </p>
          </div>
        )}

        <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", opacity: 0.3 }}>
          Powered by HackFlow
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ opacity: 0.5, fontSize: "0.85rem" }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: "0.9rem", fontFamily: mono ? "monospace" : "inherit", maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
