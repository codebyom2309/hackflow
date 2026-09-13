"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./events.module.css";
import type { UserEventsData } from "@/lib/services/event.service";

interface EventsListProps {
  hubData: UserEventsData;
  userEmail?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "var(--color-ink-muted)" },
  REGISTRATION_OPEN: { label: "Registration Open", color: "var(--color-success)" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "var(--color-warning)" },
  EVENT_READY: { label: "Ready", color: "var(--color-accent)" },
  ROUND_ACTIVE: { label: "Round Active", color: "var(--color-success)" },
  EVENT_COMPLETED: { label: "Completed", color: "var(--color-ink-muted)" },
};

export default function EventsList({ hubData, userEmail }: EventsListProps) {
  const router = useRouter();

  // Initial tab preference: participating if any, else organizing, else staff, else explore
  const initialTab =
    hubData.participating.length > 0
      ? "participating"
      : hubData.organizing.length > 0
      ? "organizing"
      : hubData.staff.length > 0
      ? "staff"
      : "explore";

  const [activeTab, setActiveTab] = useState<"participating" | "organizing" | "staff" | "explore">(initialTab);
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
        router.push(`/events/${data.slug}/manage`);
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
          <h1 className={styles.title}>Hackathons Hub</h1>
          <p className={styles.subtitle}>
            {userEmail ? (
              <>
                Signed in as <span className={styles.userEmailHighlight}>{userEmail}</span>. Manage your teams, passes, and events.
              </>
            ) : (
              "Manage your hackathon teams, passes, and events."
            )}
          </p>
        </div>
        <button
          className={styles.createButton}
          onClick={() => setShowCreateModal(true)}
        >
          + Create Hackathon
        </button>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "participating" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("participating")}
        >
          <span>🎒 My Teams & Passes</span>
          <span className={styles.badgeCount}>{hubData.participating.length}</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === "organizing" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("organizing")}
        >
          <span>⚡ Organized by Me</span>
          <span className={styles.badgeCount}>{hubData.organizing.length}</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === "staff" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("staff")}
        >
          <span>🛡️ Staff Roles</span>
          <span className={styles.badgeCount}>{hubData.staff.length}</span>
        </button>

        <button
          className={`${styles.tab} ${activeTab === "explore" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("explore")}
        >
          <span>🌐 Explore Hackathons</span>
          <span className={styles.badgeCount}>{hubData.publicEvents.length}</span>
        </button>
      </div>

      {/* TAB 1: PARTICIPATING (TEAMS & PASSES) */}
      {activeTab === "participating" && (
        <div>
          {hubData.participating.length > 0 ? (
            <div className={styles.participatingGrid}>
              {hubData.participating.map(({ event, team, isLeader }) => {
                const statusInfo = STATUS_LABELS[event.status] || {
                  label: event.status,
                  color: "var(--color-ink-muted)",
                };

                return (
                  <div key={team.id} className={styles.participatingCard}>
                    <div className={styles.cardGlowBorder} />

                    <div className={styles.cardTop}>
                      <span className={styles.eventContextTitle}>{event.title}</span>
                      <span className={isLeader ? styles.roleTag : `${styles.roleTag} ${styles.roleTagMember}`}>
                        {isLeader ? "Team Leader" : "Team Member"}
                      </span>
                    </div>

                    <div>
                      <h3 className={styles.teamHeading}>{team.name}</h3>

                      <div className={styles.metaPills}>
                        <span className={styles.metaPill}>👥 {team.memberCount} Members</span>
                        {team.college && <span className={styles.metaPill}>🏫 {team.college}</span>}
                        {team.theme && <span className={styles.metaPill}>🎯 {team.theme}</span>}
                      </div>

                      {/* Desk Assignment Status */}
                      {team.desk ? (
                        <div className={styles.deskBanner}>
                          <div>
                            <span className={styles.deskLabel}>Physical Allotment</span>
                            <div className={styles.deskValue}>
                              📍 {team.desk.roomName} · Desk {team.desk.deskNumber}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`${styles.deskBanner} ${styles.deskBannerPending}`}>
                          <div>
                            <span className={styles.deskLabel}>Physical Allotment</span>
                            <div className={styles.deskValue}>
                              ⏳ Desk Allocation in Progress
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.cardBottomActions}>
                      <span className={styles.statusIndicator}>
                        {team.status === "CHECKED_IN" || team.status === "ACTIVE"
                          ? "✅ Checked In at Venue"
                          : team.status === "WAITLISTED"
                          ? "⚠️ Waitlisted"
                          : "🎟️ Registered (Active Pass)"}
                      </span>

                      <Link
                        href={`/events/${event.slug}/dashboard`}
                        className={styles.dashboardBtn}
                      >
                        Open Dashboard <span>→</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎒</div>
              <h3 className={styles.emptyTitle}>No Registered Teams Found</h3>
              <p className={styles.emptyText}>
                You haven&apos;t registered a team in any active hackathons under this account yet.
              </p>

              <div className={styles.helpNotice}>
                <div className={styles.helpNoticeTitle}>
                  💡 Registered via Google Forms or External Sheet?
                </div>
                <p>
                  If you submitted a Google Form or registration spreadsheet, make sure you signed in with the <strong>exact same email address</strong> ({userEmail || "your email"}). Once the event organizers sync their registration roster, your team dashboard, QR badge, and desk allocation will automatically unlock right here!
                </p>
              </div>

              <button
                className={styles.emptyActionBtn}
                onClick={() => setActiveTab("explore")}
              >
                Explore Active Hackathons →
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORGANIZING (CREATED BY USER) */}
      {activeTab === "organizing" && (
        <div>
          {hubData.organizing.length > 0 ? (
            <div className={styles.grid}>
              {hubData.organizing.map((event) => {
                const statusInfo = STATUS_LABELS[event.status] || {
                  label: event.status,
                  color: "var(--color-ink-muted)",
                };
                return (
                  <button
                    key={event.id}
                    className={styles.card}
                    onClick={() => router.push(`/events/${event.slug}/manage`)}
                  >
                    <div className={styles.cardHeader}>
                      <span
                        className={styles.statusBadge}
                        style={{ color: statusInfo.color, borderColor: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                      <span className={styles.roleBadge}>Organizer</span>
                    </div>
                    <h3 className={styles.cardTitle}>{event.title}</h3>
                    {event.description && (
                      <p className={styles.cardDesc}>{event.description}</p>
                    )}
                    <div className={styles.cardFooter}>
                      <span className={styles.cardMeta}>
                        {event.eventStarts
                          ? new Date(event.eventStarts).toLocaleDateString()
                          : "Starts TBA"}
                        {event.maxTeams ? ` · Max ${event.maxTeams} teams` : ""}
                      </span>
                      <span className={styles.actionLinkText}>Manage Event →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⚡</div>
              <h3 className={styles.emptyTitle}>No Hackathons Organized Yet</h3>
              <p className={styles.emptyText}>
                Ready to run a physical hackathon with automated desks and real-time judging?
              </p>
              <button
                className={styles.emptyActionBtn}
                onClick={() => setShowCreateModal(true)}
              >
                + Create Your First Hackathon
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STAFF ROLES (COORDINATOR / JUDGE) */}
      {activeTab === "staff" && (
        <div>
          {hubData.staff.length > 0 ? (
            <div className={styles.grid}>
              {hubData.staff.map(({ event, role }) => {
                const statusInfo = STATUS_LABELS[event.status] || {
                  label: event.status,
                  color: "var(--color-ink-muted)",
                };
                const targetUrl =
                  role === "COORDINATOR"
                    ? `/events/${event.slug}/coordinator`
                    : `/events/${event.slug}/judge`;

                return (
                  <button
                    key={event.id}
                    className={styles.card}
                    onClick={() => router.push(targetUrl)}
                  >
                    <div className={styles.cardHeader}>
                      <span
                        className={styles.statusBadge}
                        style={{ color: statusInfo.color, borderColor: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                      <span className={styles.roleBadge}>{role}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{event.title}</h3>
                    <p className={styles.cardDesc}>
                      {role === "COORDINATOR"
                        ? "Scan universal participant QR badges at gates and direct teams to tables."
                        : "Evaluate shortlisted projects with dynamic rubrics and live matrices."}
                    </p>
                    <div className={styles.cardFooter}>
                      <span className={styles.cardMeta}>
                        {event.eventStarts ? new Date(event.eventStarts).toLocaleDateString() : ""}
                      </span>
                      <span className={styles.actionLinkText}>
                        {role === "COORDINATOR" ? "Open Scanner Terminal →" : "Open Judging Portal →"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🛡️</div>
              <h3 className={styles.emptyTitle}>No Staff Roles Assigned</h3>
              <p className={styles.emptyText}>
                You haven&apos;t been invited as a Judge or Volunteer Coordinator yet. Ask the event organizer for your unique role invite link to activate your access.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EXPLORE HACKATHONS */}
      {activeTab === "explore" && (
        <div>
          {hubData.publicEvents.length > 0 ? (
            <div className={styles.grid}>
              {hubData.publicEvents.map((event) => {
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
                      {event.maxTeams && (
                        <span className={styles.cardMeta}>{event.maxTeams} Teams Max</span>
                      )}
                    </div>
                    <h3 className={styles.cardTitle}>{event.title}</h3>
                    {event.description && (
                      <p className={styles.cardDesc}>{event.description}</p>
                    )}
                    <div className={styles.cardFooter}>
                      <span className={styles.cardMeta}>
                        {event.eventStarts
                          ? new Date(event.eventStarts).toLocaleDateString()
                          : "Dates TBA"}
                      </span>
                      <span className={styles.actionLinkText}>Register / View →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🌐</div>
              <h3 className={styles.emptyTitle}>No Public Hackathons Available</h3>
              <p className={styles.emptyText}>
                No hackathons are currently open for public registration. Check back soon or create your own!
              </p>
            </div>
          )}
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
            <h2 className={styles.modalTitle}>Create New Hackathon</h2>
            <p style={{ color: "var(--color-ink-muted)", fontSize: "14px", marginBottom: "var(--spacing-md)" }}>
              Initialize your event. You can set up rooms, desks, scoring criteria, and registration options right after.
            </p>
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
