"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../manage.module.css";
import { useToast, ConfirmModal } from "@/components/ui";

interface Round {
  id: string;
  roundNumber: number;
  title: string | null;
  status: string;
}

export default function ResultsManager({ slug }: { slug: string }) {
  const toast = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    inputConfig?: {
      label?: string;
      placeholder?: string;
      value: string;
      onChange: (val: string) => void;
      type?: string;
    };
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const flash = useCallback((type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
    setTimeout(() => setFeedback(null), 4000);
  }, [toast]);

  const loadRounds = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/rounds`);
      if (res.ok) {
        const json = await res.json();
        setRounds(json.data || []);
      }
    } catch {
      // ignore
    }
  }, [slug]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  function computeShortlist(roundId: string) {
    let countVal = "10";
    setModalConfig({
      isOpen: true,
      title: "Compute Round Shortlist",
      message: "Specify the number of top-performing teams to advance to the next round.",
      confirmText: "Compute Shortlist",
      inputConfig: {
        label: "Number of Advancing Teams",
        placeholder: "10",
        value: countVal,
        type: "number",
        onChange: (val) => {
          countVal = val;
          setModalConfig((prev) => ({
            ...prev,
            inputConfig: prev.inputConfig ? { ...prev.inputConfig, value: val } : undefined,
          }));
        },
      },
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        const count = Number(countVal);
        if (!count || isNaN(count) || count <= 0) {
          toast.error("Please enter a valid positive number");
          return;
        }
        setLoading(true);
        const res = await fetch(`/api/events/${slug}/rounds/${roundId}/shortlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shortlistCount: count }),
        });
        setLoading(false);
        if (res.ok) {
          const json = await res.json();
          flash("success", `Shortlist computed: ${json.data.advancing} teams advancing, ${json.data.eliminated} eliminated`);
          await loadRounds();
        } else {
          const json = await res.json().catch(() => ({}));
          flash("error", json.error || "Shortlist computation failed");
        }
      },
    });
  }

  function publishResults(roundId: string) {
    setModalConfig({
      isOpen: true,
      title: "Publish Round Results",
      message: "Are you sure you want to publish results for this round? This will update team statuses and the live leaderboard.",
      confirmText: "Publish Results",
      isDanger: false,
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        setLoading(true);
        const res = await fetch(`/api/events/${slug}/rounds/${roundId}/shortlist/publish`, {
          method: "POST",
        });
        setLoading(false);
        if (res.ok) {
          flash("success", "Results published to the live leaderboard!");
          await loadRounds();
        } else {
          const json = await res.json().catch(() => ({}));
          flash("error", json.error || "Publish failed");
        }
      },
    });
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.title}>Results & Shortlist Control</h1>
          <p className={styles.subtitle}>
            Compute normalized scores, calculate advancing shortlists, and publish rankings to the public leaderboard.
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`${styles.flash} ${feedback.type === "success" ? styles.flashSuccess : styles.flashError}`}>
          {feedback.message}
        </div>
      )}

      {/* Quick Links */}
      <div className={styles.quickActions} style={{ marginBottom: "var(--spacing-xl)" }}>
        <a
          href={`/events/${slug}/results`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.actionCard}
        >
          <span>🏆</span> Public Live Leaderboard ↗
        </a>
        <a
          href={`/api/events/${slug}/export?type=results`}
          download
          className={styles.actionCard}
        >
          <span>⬇️</span> Export Final Results CSV
        </a>
        <a
          href={`/events/${slug}/manage/certificates`}
          className={styles.actionCard}
        >
          <span>🎓</span> Generate Certificates →
        </a>
      </div>

      {/* Rounds evaluation status */}
      <h3 className={styles.sectionTitle}>Rounds Evaluation Status</h3>
      <div className={styles.roundsList}>
        {rounds.map((r) => (
          <div key={r.id} className={styles.roundCard}>
            <div className={styles.roundHeader}>
              <div>
                <h4 className={styles.roundTitle}>
                  Round {r.roundNumber}: {r.title || `Round ${r.roundNumber}`}
                </h4>
                <span className={styles.roundStatus}>
                  Status: {r.status.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => window.open(`/api/events/${slug}/rounds/${r.id}/matrix?format=csv`, "_blank")}
                  className={styles.secondaryBtn}
                >
                  📊 Scoring Matrix CSV
                </button>
                {r.status === "RESULTS_PENDING" && (
                  <button
                    onClick={() => computeShortlist(r.id)}
                    disabled={loading}
                    className={styles.secondaryBtn}
                  >
                    🧮 Compute Shortlist
                  </button>
                )}
                {r.status === "RESULTS_PENDING" && (
                  <button
                    onClick={() => publishResults(r.id)}
                    disabled={loading}
                    className={styles.primaryBtn}
                  >
                    📢 Publish Results
                  </button>
                )}
                {r.status === "RESULTS_PUBLISHED" && (
                  <span style={{ fontSize: "13px", color: "var(--color-success)", fontWeight: 600, alignSelf: "center" }}>
                    ✅ Published
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {rounds.length === 0 && (
          <div className={styles.emptyState}>
            <p>No rounds configured. Create a round in the Rounds tab to begin judging.</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        isDanger={modalConfig.isDanger}
        inputConfig={modalConfig.inputConfig}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
