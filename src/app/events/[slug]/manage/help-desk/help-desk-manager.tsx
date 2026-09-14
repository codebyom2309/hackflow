"use client";

import { useState, useCallback } from "react";
import styles from "./help-desk.module.css";
import { useToast } from "@/components/ui/Toast";

interface HelpRequestItem {
  id: string;
  category: string;
  priority: string;
  description: string;
  location: string | null;
  status: string;
  assignedStaffId: string | null;
  resolutionNotes: string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string | null;
  team: { id: string; name: string } | null;
  participant: { id: string; name: string | null; email: string } | null;
  assignedStaff: { id: string; name: string | null; email: string } | null;
}

interface HelpDeskStats {
  total: number;
  submitted: number;
  inProgress: number;
  resolved: number;
  urgent: number;
  resolutionRate: number;
}

interface HelpDeskManagerProps {
  event: {
    id: string;
    title: string;
    slug: string;
  };
  initialRequests: HelpRequestItem[];
  initialStats: HelpDeskStats;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  TECHNICAL_ISSUE: { label: "Technical / Wi-Fi", icon: "💻" },
  VENUE_ISSUE: { label: "Venue & Power", icon: "🔌" },
  REGISTRATION_ISSUE: { label: "Registration & Auth", icon: "📋" },
  TEAM_ISSUE: { label: "Team & Member", icon: "👥" },
  FOOD_FACILITIES: { label: "Food & Facilities", icon: "🍕" },
  MENTOR_STAFF: { label: "Mentor / Assistance", icon: "🙋" },
  JUDGE_RELATED: { label: "Judging Help", icon: "⚖️" },
  SUBMISSION_ISSUE: { label: "Project Submission", icon: "📤" },
  OTHER: { label: "General Support", icon: "❓" },
};

export default function HelpDeskManager({
  event,
  initialRequests,
  initialStats,
}: HelpDeskManagerProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<HelpRequestItem[]>(initialRequests);
  const [stats, setStats] = useState<HelpDeskStats>(initialStats);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [selectedTicket, setSelectedTicket] = useState<HelpRequestItem | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh ticket queue
  const refreshTickets = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/events/${event.slug}/help-requests?status=${filterStatus}&priority=${filterPriority}`
      );
      if (res.ok) {
        const json = await res.json();
        setRequests(json.data.requests);
        if (json.data.stats) setStats(json.data.stats);
      }
    } catch {
      toast.error("Failed to refresh help requests");
    } finally {
      setRefreshing(false);
    }
  }, [event.slug, filterStatus, filterPriority, toast]);

  // Update ticket
  async function handleUpdateTicket(
    ticketId: string,
    newStatus: string,
    notes?: string
  ) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/help-requests/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolutionNotes: notes || undefined,
          claim: newStatus === "IN_PROGRESS" || newStatus === "ASSIGNED",
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Update failed");
      }

      toast.success(`Ticket #${ticketId.slice(0, 6)} marked as ${newStatus}!`);
      setSelectedTicket(null);
      setResolutionText("");
      refreshTickets();
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || "Failed to update ticket");
    } finally {
      setUpdating(false);
    }
  }

  // Filtered requests
  const filtered = requests.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (filterPriority !== "ALL" && r.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>OPERATIONS & SUPPORT</span>
            {stats.urgent > 0 && (
              <span className={styles.urgentAlert}>
                🚨 {stats.urgent} Urgent Ticket{stats.urgent > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h1 className={styles.title}>Participant Help Desk Queue</h1>
          <p className={styles.subtitle}>
            Live participant issues and tickets dispatched from the hackathon floor.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshTickets}
          disabled={refreshing}
          className={styles.refreshBtn}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh Feed"}
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Requests</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Unassigned / New</span>
          <span className={`${styles.statValue} ${styles.statWarning}`}>
            {stats.submitted}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>In Progress</span>
          <span className={`${styles.statValue} ${styles.statAccent}`}>
            {stats.inProgress}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Resolved</span>
          <span className={`${styles.statValue} ${styles.statSuccess}`}>
            {stats.resolved}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Resolution Rate</span>
          <span className={styles.statValue}>{stats.resolutionRate}%</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label>Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.select}
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted / New</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Priority:</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={styles.select}
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">🚨 Urgent</option>
            <option value="HIGH">⚠️ High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Ticket List */}
      <div className={styles.ticketsList}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✨</span>
            <h3>No pending support requests</h3>
            <p>All participant issues in this queue have been resolved.</p>
          </div>
        ) : (
          filtered.map((ticket) => {
            const cat = CATEGORY_LABELS[ticket.category] || {
              label: ticket.category,
              icon: "📌",
            };
            const isUrgent = ticket.priority === "URGENT";
            const isHigh = ticket.priority === "HIGH";

            return (
              <div
                key={ticket.id}
                className={`${styles.ticketCard} ${
                  isUrgent ? styles.urgentCard : isHigh ? styles.highCard : ""
                }`}
              >
                <div className={styles.ticketTop}>
                  <div className={styles.ticketMeta}>
                    <span
                      className={`${styles.priorityPill} ${
                        isUrgent
                          ? styles.pUrgent
                          : isHigh
                          ? styles.pHigh
                          : styles.pNormal
                      }`}
                    >
                      {ticket.priority}
                    </span>
                    <span className={styles.categoryPill}>
                      {cat.icon} {cat.label}
                    </span>
                    <span className={styles.ticketId}>#{ticket.id.slice(0, 6)}</span>
                  </div>

                  <span
                    className={`${styles.statusPill} ${
                      ticket.status === "RESOLVED"
                        ? styles.sResolved
                        : ticket.status === "IN_PROGRESS" || ticket.status === "ASSIGNED"
                        ? styles.sProgress
                        : styles.sSubmitted
                    }`}
                  >
                    {ticket.status.replace("_", " ")}
                  </span>
                </div>

                <div className={styles.ticketMain}>
                  <div className={styles.teamRow}>
                    <strong className={styles.teamName}>
                      {ticket.team?.name || "Hacker Team"}
                    </strong>
                    {ticket.location && (
                      <span className={styles.locationTag}>📍 {ticket.location}</span>
                    )}
                  </div>

                  <p className={styles.descriptionText}>{ticket.description}</p>

                  {ticket.resolutionNotes && (
                    <div className={styles.resolutionBox}>
                      <strong>Staff Note:</strong> {ticket.resolutionNotes}
                    </div>
                  )}
                </div>

                <div className={styles.ticketFooter}>
                  <div className={styles.reporterInfo}>
                    <span>
                      Reported by: <strong>{ticket.participant?.name || "Participant"}</strong>
                    </span>
                    {ticket.assignedStaff && (
                      <span className={styles.staffAssigned}>
                        Assigned: <strong>{ticket.assignedStaff.name || ticket.assignedStaff.email}</strong>
                      </span>
                    )}
                  </div>

                  <div className={styles.actionButtons}>
                    {ticket.status !== "RESOLVED" ? (
                      <>
                        {ticket.status === "SUBMITTED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateTicket(ticket.id, "IN_PROGRESS")}
                            disabled={updating}
                            className={styles.claimBtn}
                          >
                            Claim / In Progress
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(ticket)}
                          className={styles.resolveBtn}
                        >
                          Resolve Ticket ✓
                        </button>
                      </>
                    ) : (
                      <span className={styles.resolvedText}>
                        ✓ Resolved on {new Date(ticket.resolvedAt || Date.now()).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resolution Modal */}
      {selectedTicket && (
        <div className={styles.modalOverlay} onClick={() => setSelectedTicket(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Resolve Help Request #{selectedTicket.id.slice(0, 6)}</h3>
            <p className={styles.modalSubtitle}>
              Team: <strong>{selectedTicket.team?.name}</strong> | Location:{" "}
              <strong>{selectedTicket.location}</strong>
            </p>

            <div className={styles.modalField}>
              <label>Resolution Notes / Message for Hacker:</label>
              <textarea
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="e.g. Wi-Fi adapter provided; replaced power strip at desk 12."
                className={styles.textarea}
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className={styles.modalCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateTicket(selectedTicket.id, "RESOLVED", resolutionText.trim())
                }
                disabled={updating}
                className={styles.modalConfirm}
              >
                {updating ? "Saving..." : "Confirm Resolved ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
