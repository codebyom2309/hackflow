"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ParticipantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ParticipantError]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "75vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        textAlign: "center",
        color: "var(--color-ink, #f1f5f9)",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(59, 130, 246, 0.12)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          marginBottom: "1.25rem",
          boxShadow: "0 0 30px rgba(59, 130, 246, 0.2)",
        }}
      >
        🎒
      </div>

      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 800,
          color: "var(--color-ink, #ffffff)",
          margin: "0 0 0.5rem",
          letterSpacing: "-0.5px",
        }}
      >
        Participant Companion
      </h1>

      <p
        style={{
          fontSize: "0.95rem",
          color: "var(--color-ink-muted, rgba(255, 255, 255, 0.65))",
          maxWidth: 480,
          margin: "0 0 1.75rem",
          lineHeight: 1.5,
        }}
      >
        We encountered an issue loading your team passport or desk details. You can reload your pass or return to the events hub.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "#ffffff",
            border: "none",
            padding: "0.75rem 1.6rem",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(59, 130, 246, 0.35)",
          }}
        >
          🔄 Reload Dashboard
        </button>

        <Link
          href="/events"
          style={{
            display: "inline-block",
            background: "rgba(255, 255, 255, 0.08)",
            color: "var(--color-ink, #e2e8f0)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "0.75rem 1.4rem",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          ← Return to Events
        </Link>
      </div>
    </div>
  );
}
