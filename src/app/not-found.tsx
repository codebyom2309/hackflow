import Link from "next/link";

export default function NotFound() {
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
          fontSize: "4rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-2px",
          marginBottom: "0.25rem",
        }}
      >
        404
      </div>

      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 0.5rem",
        }}
      >
        Page Not Found
      </h1>

      <p
        style={{
          fontSize: "0.95rem",
          color: "rgba(255, 255, 255, 0.55)",
          maxWidth: 440,
          margin: "0 0 1.75rem",
          lineHeight: 1.5,
        }}
      >
        The page you are looking for does not exist, has been moved, or you may not have authorization to view it.
      </p>

      <Link
        href="/events"
        style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color: "#ffffff",
          padding: "0.65rem 1.4rem",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: "0.85rem",
          textDecoration: "none",
          boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
        }}
      >
        ← Explore Events
      </Link>
    </div>
  );
}
