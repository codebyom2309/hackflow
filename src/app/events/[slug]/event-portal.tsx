"use client";

import { useState } from "react";
import styles from "./event-portal.module.css";

interface EventPortalProps {
  event: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    status: string;
    maxTeams: number | null;
    eventStarts: Date | string | null;
    eventEnds: Date | string | null;
    registrationCloses?: Date | string | null;
  };
  userRole: string | null;
}

export default function EventPortal({ event, userRole }: EventPortalProps) {
  const [teamName, setTeamName] = useState("");
  const [memberCount, setMemberCount] = useState(4);
  const [registering, setRegistering] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || registering) return;

    setRegistering(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/events/${event.slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          members: [
            // Leader will be populated from session on the server
            { name: "Team Leader", email: "leader@team.com", phone: "", isLeader: true },
          ],
        }),
      });

      if (res.ok) {
        setFeedback({ type: "success", message: "Registration successful! Redirecting to dashboard..." });
        window.location.href = `/events/${event.slug}/dashboard`;
      } else {
        const json = await res.json();
        setFeedback({ type: "error", message: json.error || "Registration failed" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error during registration" });
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className={styles.container}>
      {/* Event Header */}
      <div className={styles.headerCard}>
        <div className={styles.statusRow}>
          <span className={styles.statusBadge}>{event.status.replace(/_/g, " ")}</span>
          {userRole && <span className={styles.roleBadge}>Role: {userRole}</span>}
        </div>
        <h1 className={styles.title}>{event.title}</h1>
        {event.description && <p className={styles.description}>{event.description}</p>}

        <div className={styles.metaRow}>
          {event.eventStarts && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Starts</span>
              <span className={styles.metaValue}>{new Date(event.eventStarts).toLocaleString()}</span>
            </div>
          )}
          {event.eventEnds && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Ends</span>
              <span className={styles.metaValue}>{new Date(event.eventEnds).toLocaleString()}</span>
            </div>
          )}
          {event.maxTeams && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Capacity</span>
              <span className={styles.metaValue}>{event.maxTeams} Teams</span>
            </div>
          )}
        </div>
      </div>

      {/* Registration Form */}
      {event.status === "REGISTRATION_OPEN" ? (
        <div className={styles.regCard}>
          <h2 className={styles.regTitle}>Register Your Team</h2>
          <p className={styles.regSubtitle}>Enter your team details to join the hackathon.</p>

          {feedback && (
            <div className={`${styles.feedback} ${feedback.type === "success" ? styles.success : styles.error}`}>
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleRegister} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Team Name</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. Binary Beasts"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Expected Member Count</label>
              <input
                type="number"
                className={styles.input}
                min={1}
                max={6}
                value={memberCount}
                onChange={(e) => setMemberCount(Number(e.target.value))}
              />
            </div>

            <button type="submit" disabled={registering || !teamName.trim()} className={styles.submitBtn}>
              {registering ? "Registering..." : "Submit Registration"}
            </button>
          </form>
        </div>
      ) : (
        <div className={styles.noticeCard}>
          <h3>Registration Status</h3>
          <p>
            Registration for this event is currently <strong>{event.status.replace(/_/g, " ").toLowerCase()}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
