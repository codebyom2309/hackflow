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

  const isForbidden = error.message?.includes("Access denied") || error.message?.includes("FORBIDDEN") || (error as any).code === "FORBIDDEN";

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
          background: isForbidden ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
          border: isForbidden ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.75rem",
          marginBottom: "1rem",
        }}
      >
        {isForbidden ? "🛡️" : "⚠️"}
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
        {isForbidden ? "Access Restricted" : "Something went wrong"}
      </h1>

      <p
        style={{
          fontSize: "0.95rem",
          color: "rgba(255, 255, 255, 0.65)",
          maxWidth: 480,
          margin: "0 0 1.75rem",
          lineHeight: 1.5,
        }}
      >
        {isForbidden
          ? "You do not have the required permissions to view this section of HackFlow. Each role has a dedicated portal."
          : "An unexpected error occurred while processing this request. You can attempt to reload the section or navigate back."}
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        {isForbidden ? (
          <Link
            href="/events"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "#ffffff",
              border: "none",
              padding: "0.65rem 1.4rem",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "0.85rem",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
            }}
          >
            ← Return to Events Dashboard
          </Link>
        ) : (
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
        )}

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
