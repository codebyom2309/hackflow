"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./events.module.css";

interface Event {
  id: string;
  title: string;
  slug: string;
  status: string;
  description: string | null;
  maxTeams: number | null;
  eventStarts: Date | string | null;
  userRole?: string;
}

interface EventsListProps {
  events: Event[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "var(--color-ink-muted)" },
  REGISTRATION_OPEN: { label: "Registration Open", color: "var(--color-success)" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "var(--color-warning)" },
  EVENT_READY: { label: "Ready", color: "var(--color-accent)" },
  ROUND_ACTIVE: { label: "Round Active", color: "var(--color-success)" },
  EVENT_COMPLETED: { label: "Completed", color: "var(--color-ink-muted)" },
};

export default function EventsList({ events }: EventsListProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (res.ok) {
        const { data } = await res.json();
        router.push(`/events/${data.slug}`);
      }
    } catch {
      console.error("Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Events</h1>
          <p className={styles.subtitle}>
            {events.length === 0
              ? "Create your first hackathon event to get started."
              : `${events.length} event${events.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          className={styles.createButton}
          onClick={() => setShowCreateModal(true)}
        >
          + New Event
        </button>
      </div>

      {/* Events Grid */}
      {events.length > 0 ? (
        <div className={styles.grid}>
          {events.map((event) => {
            const statusInfo = STATUS_LABELS[event.status] || {
              label: event.status,
              color: "var(--color-ink-muted)",
            };
            return (
              <button
                key={event.id}
                className={styles.card}
                onClick={() => router.push(`/events/${event.slug}`)}
              >
                <div className={styles.cardHeader}>
                  <span
                    className={styles.statusBadge}
                    style={{ color: statusInfo.color, borderColor: statusInfo.color }}
                  >
                    {statusInfo.label}
                  </span>
                  {event.userRole && (
                    <span className={styles.roleBadge}>{event.userRole}</span>
                  )}
                </div>
                <h3 className={styles.cardTitle}>{event.title}</h3>
                {event.description && (
                  <p className={styles.cardDesc}>
                    {event.description.substring(0, 100)}
                    {event.description.length > 100 ? "..." : ""}
                  </p>
                )}
                <div className={styles.cardFooter}>
                  {event.eventStarts && (
                    <span className={styles.cardMeta}>
                      {new Date(event.eventStarts).toLocaleDateString()}
                    </span>
                  )}
                  {event.maxTeams && (
                    <span className={styles.cardMeta}>
                      Max {event.maxTeams} teams
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚀</div>
          <h3>No events yet</h3>
          <p>Create your first hackathon event and start organizing!</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className={styles.overlay}
          onClick={() => setShowCreateModal(false)}
        >
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateEvent}
          >
            <h2 className={styles.modalTitle}>Create New Event</h2>
            <input
              type="text"
              className={styles.input}
              placeholder="Event title (e.g., HackUEM 2026)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              minLength={3}
              maxLength={255}
              required
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={creating || !newTitle.trim()}
              >
                {creating ? "Creating..." : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
