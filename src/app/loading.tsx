export default function GlobalLoading() {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        color: "#94a3b8",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid rgba(99, 102, 241, 0.15)",
          borderTopColor: "#6366f1",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: "0.9rem", fontWeight: 500, letterSpacing: "0.5px" }}>
        Loading HackFlow...
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
