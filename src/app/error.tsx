"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
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
        color: "#f1f5f9",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.75rem",
          marginBottom: "1rem",
        }}
      >
        ⚠️
      </div>

      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 0.5rem",
          letterSpacing: "-0.5px",
        }}
      >
        Something went wrong
      </h1>

      <p
        style={{
          fontSize: "0.95rem",
          color: "rgba(255, 255, 255, 0.55)",
          maxWidth: 480,
          margin: "0 0 1.75rem",
          lineHeight: 1.5,
        }}
      >
        An unexpected error occurred while processing this request. You can attempt to reload the section or navigate back.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#ffffff",
            border: "none",
            padding: "0.65rem 1.4rem",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
          }}
        >
          🔄 Try Again
        </button>

        <Link
          href="/events"
          style={{
            display: "inline-block",
            background: "rgba(255, 255, 255, 0.06)",
            color: "#e2e8f0",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "0.65rem 1.4rem",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          ← Return to Events
        </Link>
      </div>
    </div>
  );
}
