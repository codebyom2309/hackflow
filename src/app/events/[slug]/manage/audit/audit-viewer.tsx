"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../manage.module.css";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  userId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export default function AuditViewer({ slug }: { slug: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${slug}/audit?limit=100`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const filteredLogs = logs.filter((log) => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.entityType.toLowerCase().includes(term) ||
      (log.entityId && log.entityId.toLowerCase().includes(term))
    );
  });

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.title}>System Audit Trail</h1>
          <p className={styles.subtitle}>
            Cryptographically logged activity trail tracking all desk reallocations, score updates, and status changes.
          </p>
        </div>
        <button onClick={loadAudit} disabled={loading} className={styles.secondaryBtn}>
          {loading ? "Refreshing..." : "↻ Refresh Logs"}
        </button>
      </div>

      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <input
          type="text"
          placeholder="Filter audit actions (e.g. DESK_REASSIGNED, SCORE_SUBMITTED)..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={styles.input}
          style={{ width: "100%", maxWidth: 460 }}
        />
      </div>

      <div className={styles.auditList}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 180px",
            gap: "var(--spacing-md)",
            padding: "8px 16px",
            background: "var(--color-surface-2)",
            borderRadius: "var(--rounded-sm) var(--rounded-sm) 0 0",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-ink-muted)",
          }}
        >
          <span>Action</span>
          <span>Entity</span>
          <span style={{ textAlign: "right" }}>Timestamp</span>
        </div>

        {filteredLogs.map((log, idx) => (
          <div key={log.id || idx} className={styles.auditRow}>
            <div>
              <span className={styles.auditAction}>{log.action}</span>
              {log.entityId && (
                <span style={{ fontSize: "11px", color: "var(--color-ink-muted)", marginLeft: "8px" }}>
                  id: {log.entityId.slice(0, 8)}...
                </span>
              )}
            </div>
            <span className={styles.auditEntity}>{log.entityType}</span>
            <span className={styles.auditTime}>{new Date(log.createdAt).toLocaleString()}</span>
          </div>
        ))}

        {!loading && filteredLogs.length === 0 && (
          <div className={styles.emptyState}>
            <p>No audit events match your filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
