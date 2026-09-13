"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/components/ui";
import styles from "./teams.module.css";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  college?: string | null;
  isLeader: boolean;
}

interface TeamData {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  leaderEmail?: string | null;
  leaderPhone?: string | null;
  college?: string | null;
  theme?: string | null;
  problemStatement?: string | null;
  projectName?: string | null;
  projectDescription?: string | null;
  githubUrl?: string | null;
  pptUrl?: string | null;
  demoUrl?: string | null;
  qrToken: string;
  members: TeamMember[];
  desk: { deskNumber: number; roomName: string; roomNumber: number } | null;
  deskId?: string | null;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  formResponses?: any;
}

interface TeamStats {
  total: number;
  statusCounts: Record<string, number>;
  totalParticipants: number;
  unseatedCount?: number;
  seatedCount?: number;
}

interface EventInfo {
  id: string;
  title: string;
  slug: string;
}

const STATUSES = [
  "REGISTERED",
  "WAITLISTED",
  "CHECKED_IN",
  "ACTIVE",
  "SHORTLISTED",
  "ELIMINATED",
  "FINALIST",
  "WINNER",
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", // Indigo -> Purple
  "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", // Cyan -> Blue
  "linear-gradient(135deg, #10b981 0%, #059669 100%)", // Emerald -> Teal
  "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)", // Amber -> Orange
  "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)", // Pink -> Violet
  "linear-gradient(135deg, #14b8a6 0%, #0284c7 100%)", // Teal -> Sky
  "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)", // Violet -> Fuchsia
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isRecentRegistration(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  // Within the last 24 hours
  return diffMs > 0 && diffMs < 24 * 60 * 60 * 1000;
}

function getTrackIcon(theme?: string | null): string {
  if (!theme) return "🚀";
  const t = theme.toLowerCase();
  if (t.includes("ai") || t.includes("ml") || t.includes("intel")) return "🤖";
  if (t.includes("health") || t.includes("med") || t.includes("bio")) return "🏥";
  if (t.includes("fin") || t.includes("crypto") || t.includes("web3") || t.includes("block")) return "🪙";
  if (t.includes("open") || t.includes("innov")) return "💡";
  if (t.includes("green") || t.includes("climate") || t.includes("eco")) return "🌱";
  if (t.includes("edu") || t.includes("learn")) return "🎓";
  if (t.includes("sec") || t.includes("cyber")) return "🛡️";
  return "⚡";
}

export default function TeamManager({ event }: { event: EventInfo }) {
  const toast = useToast();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [seatingFilter, setSeatingFilter] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Available desks across all rooms for single-click assignment
  const [availableDesks, setAvailableDesks] = useState<
    Array<{ id: string; deskNumber: number; capacity: number; roomName: string }>
  >([]);
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null);
  const [targetDeskId, setTargetDeskId] = useState<string>("");

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (sortBy) params.set("sortBy", sortBy);
    if (seatingFilter) params.set("seating", seatingFilter);

    try {
      const res = await fetch(`/api/events/${event.slug}/teams?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTeams(json.data.teams || []);
        setStats(json.data.stats || null);
      }
    } finally {
      setLoading(false);
    }
  }, [event.slug, search, statusFilter, sortBy, seatingFilter]);

  // Fetch all rooms and their available desks
  const fetchAvailableDesks = useCallback(async () => {
    try {
      const roomsRes = await fetch(`/api/events/${event.slug}/rooms`);
      if (!roomsRes.ok) return;
      const roomsJson = await roomsRes.json();
      const roomsList = Array.isArray(roomsJson.data)
        ? roomsJson.data
        : Array.isArray(roomsJson.data?.rooms)
        ? roomsJson.data.rooms
        : [];

      const allFreeDesks: Array<{ id: string; deskNumber: number; capacity: number; roomName: string }> = [];
      for (const r of roomsList) {
        const desksRes = await fetch(`/api/events/${event.slug}/desks?roomId=${r.id}`);
        if (desksRes.ok) {
          const desksJson = await desksRes.json();
          const free = (desksJson.data || []).filter((d: any) => !d.isAllocated);
          for (const d of free) {
            allFreeDesks.push({
              id: d.id,
              deskNumber: d.deskNumber,
              capacity: d.capacity,
              roomName: r.name,
            });
          }
        }
      }
      setAvailableDesks(allFreeDesks);
    } catch {
      // ignore
    }
  }, [event.slug]);

  useEffect(() => {
    fetchTeams();
    fetchAvailableDesks();
  }, [fetchTeams, fetchAvailableDesks]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => fetchTeams(), 250);
    return () => clearTimeout(timeout);
  }, [search, fetchTeams]);

  // Handle Quick Filter clicks
  function handleQuickFilter(filterKey: string) {
    setQuickFilter(filterKey);
    if (filterKey === "ALL") {
      setSeatingFilter("");
      setStatusFilter("");
    } else if (filterKey === "UNSEATED") {
      setSeatingFilter("unseated");
      setStatusFilter("");
    } else if (filterKey === "SEATED") {
      setSeatingFilter("seated");
      setStatusFilter("");
    } else if (filterKey === "RECENT") {
      setSeatingFilter("");
      setStatusFilter("");
      setSortBy("recent");
    } else if (filterKey === "ACTIVE") {
      setSeatingFilter("");
      setStatusFilter("ACTIVE");
    } else if (filterKey === "SHORTLISTED") {
      setSeatingFilter("");
      setStatusFilter("SHORTLISTED");
    }
  }

  // Status update handler
  async function handleStatusChange(teamId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/events/${event.slug}/teams`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamIds: [teamId],
          updates: { status: newStatus },
        }),
      });
      if (res.ok) {
        toast.success(`Team status updated to ${newStatus.replace(/_/g, " ")}`);
        fetchTeams();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error updating team status");
    }
  }

  // Desk assignment handler directly from dossier
  async function handleDeskAssign(teamId: string, deskId: string) {
    if (!deskId) return;
    setAssigningTeamId(teamId);
    try {
      const res = await fetch(`/api/events/${event.slug}/desks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          teamId,
          deskId,
        }),
      });
      if (res.ok) {
        toast.success("Desk allocated successfully to team!");
        setTargetDeskId("");
        await fetchTeams();
        await fetchAvailableDesks();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to assign desk");
      }
    } catch {
      toast.error("Network error allocating desk");
    } finally {
      setAssigningTeamId(null);
    }
  }

  // Release desk handler
  async function handleDeskRelease(teamId: string) {
    setAssigningTeamId(teamId);
    try {
      const res = await fetch(`/api/events/${event.slug}/desks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release",
          teamId,
        }),
      });
      if (res.ok) {
        toast.success("Desk released successfully");
        await fetchTeams();
        await fetchAvailableDesks();
      } else {
        toast.error("Failed to release desk");
      }
    } catch {
      toast.error("Network error releasing desk");
    } finally {
      setAssigningTeamId(null);
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  }

  // Group available desks by room name
  const desksByRoom = useMemo(() => {
    const map: Record<string, typeof availableDesks> = {};
    for (const d of availableDesks) {
      if (!map[d.roomName]) map[d.roomName] = [];
      map[d.roomName].push(d);
    }
    return map;
  }, [availableDesks]);

  // Seated percentage for mini progress bar
  const totalCount = stats?.total || teams.length;
  const seatedCount = stats?.seatedCount ?? teams.filter((t) => !!t.desk).length;
  const unseatedCount = stats?.unseatedCount ?? (totalCount - seatedCount);
  const seatedPercent = totalCount > 0 ? Math.round((seatedCount / totalCount) * 100) : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleBadge}>VENUE OS · LIVE ROSTER</div>
          <h1 className={styles.pageTitle}>👥 Team Management</h1>
          <p className={styles.pageSubtitle}>
            Complete dossier of all registered teams with verified form submissions, payment UTRs, and desk allocations.
          </p>
        </div>
        <div className={styles.headerActions}>
          <a href={`/events/${event.slug}/manage/import`} className={styles.primaryBtn}>
            <span>📥</span>
            <span>Import / Live Sync</span>
          </a>
          <a
            href={`/api/events/${event.slug}/export?type=teams`}
            download
            className={styles.secondaryBtn}
          >
            <span>⬇</span>
            <span>Export Full CSV</span>
          </a>
        </div>
      </div>

      {/* Interactive Metric Cards */}
      <div className={styles.metricsGrid}>
        {/* Card 1: Total Teams */}
        <div
          className={`${styles.metricCard} ${quickFilter === "ALL" ? styles.metricCardActive : ""}`}
          onClick={() => handleQuickFilter("ALL")}
          role="button"
          tabIndex={0}
        >
          <div className={styles.metricTop}>
            <span className={styles.metricLabel}>Total Teams</span>
            <span className={styles.metricIcon}>👥</span>
          </div>
          <div className={styles.metricValue}>{stats?.total ?? teams.length}</div>
          <div className={styles.metricSub}>
            <span>{stats?.totalParticipants || 0} participants registered</span>
          </div>
        </div>

        {/* Card 2: Seating Allotment */}
        <div
          className={`${styles.metricCard} ${quickFilter === "UNSEATED" ? styles.metricCardActive : ""}`}
          onClick={() => handleQuickFilter("UNSEATED")}
          role="button"
          tabIndex={0}
        >
          <div className={styles.metricTop}>
            <span className={styles.metricLabel}>Desk Allocation</span>
            <span className={styles.metricIcon}>🪑</span>
          </div>
          <div className={styles.metricValue}>
            {seatedCount} <span className={styles.metricDenominator}>/ {totalCount} Seated</span>
          </div>
          <div className={styles.progressBarWrapper}>
            <div className={styles.progressBarFill} style={{ width: `${seatedPercent}%` }} />
          </div>
          <div className={styles.metricSub}>
            <span style={{ color: unseatedCount > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
              {unseatedCount > 0 ? `⚠️ ${unseatedCount} teams need desks` : "✓ All teams seated"}
            </span>
          </div>
        </div>

        {/* Card 3: Active & Checked In */}
        <div
          className={`${styles.metricCard} ${quickFilter === "ACTIVE" ? styles.metricCardActive : ""}`}
          onClick={() => handleQuickFilter("ACTIVE")}
          role="button"
          tabIndex={0}
        >
          <div className={styles.metricTop}>
            <span className={styles.metricLabel}>In-Venue Active</span>
            <span className={styles.metricIcon}>⚡</span>
          </div>
          <div className={styles.metricValue}>
            {(stats?.statusCounts?.["ACTIVE"] || 0) + (stats?.statusCounts?.["CHECKED_IN"] || 0)}
          </div>
          <div className={styles.metricSub}>
            <span>{stats?.statusCounts?.["CHECKED_IN"] || 0} checked-in at desk</span>
          </div>
        </div>

        {/* Card 4: Shortlisted / Finalists */}
        <div
          className={`${styles.metricCard} ${quickFilter === "SHORTLISTED" ? styles.metricCardActive : ""}`}
          onClick={() => handleQuickFilter("SHORTLISTED")}
          role="button"
          tabIndex={0}
        >
          <div className={styles.metricTop}>
            <span className={styles.metricLabel}>Shortlisted &amp; Winners</span>
            <span className={styles.metricIcon}>⭐</span>
          </div>
          <div className={styles.metricValue}>
            {(stats?.statusCounts?.["SHORTLISTED"] || 0) +
              (stats?.statusCounts?.["FINALIST"] || 0) +
              (stats?.statusCounts?.["WINNER"] || 0)}
          </div>
          <div className={styles.metricSub}>
            <span>Judging &amp; finalist pipeline</span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className={styles.toolbarCard}>
        <div className={styles.searchRow}>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by team, leader, email, phone, college, or track..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setSearch("")}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className={styles.toolbarControls}>
            {/* Sort Dropdown */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Sort by:</label>
              <select
                className={styles.selectInput}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">🕒 Most Recent First</option>
                <option value="unseated">🪑 Unseated First</option>
                <option value="name">🔤 Team Name (A-Z)</option>
                <option value="members">👥 Team Size (High to Low)</option>
                <option value="oldest">⏳ Oldest First</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Status:</label>
              <select
                className={styles.selectInput}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setQuickFilter("");
                }}
              >
                <option value="">All Statuses ({totalCount})</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")} ({stats?.statusCounts?.[s] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                fetchTeams();
                fetchAvailableDesks();
                toast.success("Team roster updated");
              }}
              disabled={loading}
              className={styles.refreshBtn}
              title="Refresh team roster"
            >
              <span className={loading ? styles.spinner : ""}>🔄</span>
              <span>{loading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className={styles.chipRow}>
          <button
            type="button"
            className={`${styles.filterChip} ${quickFilter === "ALL" && !statusFilter && !seatingFilter ? styles.filterChipActive : ""}`}
            onClick={() => handleQuickFilter("ALL")}
          >
            All Teams ({totalCount})
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${seatingFilter === "unseated" ? styles.filterChipActive : ""}`}
            onClick={() => handleQuickFilter("UNSEATED")}
          >
            ⚠️ Unseated ({unseatedCount})
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${seatingFilter === "seated" ? styles.filterChipActive : ""}`}
            onClick={() => handleQuickFilter("SEATED")}
          >
            ✓ Seated ({seatedCount})
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${sortBy === "recent" ? styles.filterChipActive : ""}`}
            onClick={() => handleQuickFilter("RECENT")}
          >
            🕒 Most Recent
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${statusFilter === "ACTIVE" ? styles.filterChipActive : ""}`}
            onClick={() => handleQuickFilter("ACTIVE")}
          >
            ⚡ Active ({stats?.statusCounts?.["ACTIVE"] || 0})
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${statusFilter === "SHORTLISTED" ? styles.filterChipActive : ""}`}
            onClick={() => handleQuickFilter("SHORTLISTED")}
          >
            ⭐ Shortlisted ({stats?.statusCounts?.["SHORTLISTED"] || 0})
          </button>
        </div>
      </div>

      {/* Team Roster List */}
      <div className={styles.teamList}>
        {teams.map((team) => {
          const resp = team.formResponses || {};
          const leaderData = resp.leader || {};
          const rawMembers: any[] = Array.isArray(resp.members) ? resp.members : [];
          const isExpanded = expandedId === team.id;
          const isRecent = isRecentRegistration(team.createdAt);
          const relativeTime = formatRelativeTime(team.createdAt);
          const avatarGradient = getAvatarStyle(team.name);
          const initials = getInitials(team.name);
          const trackIcon = getTrackIcon(team.theme);

          return (
            <div key={team.id} className={styles.teamCardWrapper}>
              <div
                className={`${styles.teamRow} ${isExpanded ? styles.teamRowExpanded : ""}`}
                onClick={() => setExpandedId(isExpanded ? null : team.id)}
              >
                {/* Generative Avatar */}
                <div className={styles.teamAvatar} style={{ background: avatarGradient }}>
                  {initials}
                </div>

                {/* Team Info */}
                <div className={styles.teamInfo}>
                  <div className={styles.teamNameRow}>
                    <span className={styles.teamNameText}>{team.name}</span>
                    {team.theme && (
                      <span className={styles.themeBadge}>
                        <span>{trackIcon}</span>
                        <span>{team.theme}</span>
                      </span>
                    )}
                    {isRecent && (
                      <span className={styles.newBadge} title="Registered recently">
                        ✨ NEW
                      </span>
                    )}
                  </div>

                  <div className={styles.teamMetaRow}>
                    {relativeTime && (
                      <span className={styles.metaTimestamp} title={team.createdAt ? new Date(team.createdAt).toLocaleString() : ""}>
                        🕒 {relativeTime}
                      </span>
                    )}
                    <span className={styles.metaItem}>👥 {team.memberCount} members</span>
                    {team.leaderEmail && (
                      <span className={styles.metaItem} onClick={(e) => e.stopPropagation()}>
                        ✉️ <a href={`mailto:${team.leaderEmail}`} className={styles.metaLink}>{team.leaderEmail}</a>
                      </span>
                    )}
                    {team.leaderPhone && (
                      <span className={styles.metaItem} onClick={(e) => e.stopPropagation()}>
                        📞 <a href={`tel:${team.leaderPhone}`} className={styles.metaLink}>{team.leaderPhone}</a>
                      </span>
                    )}
                    {team.college && (
                      <span className={styles.metaItem}>🏫 {team.college}</span>
                    )}
                    {team.desk ? (
                      <span className={styles.deskBadge}>
                        🏢 {team.desk.roomName} · Desk D{team.desk.deskNumber}
                      </span>
                    ) : (
                      <span className={styles.unseatedBadge}>
                        ⚠️ Unseated
                      </span>
                    )}
                  </div>
                </div>

                {/* Checked in pulse */}
                {team.isCheckedIn && (
                  <div
                    className={styles.checkedInDot}
                    title={`Checked In at ${team.checkedInAt ? new Date(team.checkedInAt).toLocaleTimeString() : ""}`}
                  />
                )}

                {/* Status Badge */}
                <span className={`${styles.statusBadge} ${styles[`status${team.status}`] || ""}`}>
                  {team.status.replace(/_/g, " ")}
                </span>

                {/* Expand Indicator Chevron */}
                <div className={`${styles.expandChevron} ${isExpanded ? styles.expandChevronOpen : ""}`}>
                  ▼
                </div>
              </div>

              {/* Expanded Full Dossier Panel */}
              {isExpanded && (
                <div className={styles.expandPanel}>
                  {/* Section 1: Desk Allocation & Quick Status Control */}
                  <div className={styles.dossierCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <span>🏢</span>
                        <span>Desk Allocation &amp; Station Management</span>
                      </div>
                      <div className={styles.stationBadge}>
                        {team.desk ? (
                          <span style={{ color: "var(--color-success)", fontWeight: 700 }}>
                            ✓ Seated: {team.desk.roomName} — Desk D{team.desk.deskNumber}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-warning)", fontWeight: 700 }}>
                            ⚠️ No Desk Assigned (Needs Allocation)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.allotmentControls}>
                      <div className={styles.selectWrapper}>
                        <select
                          className={styles.allotmentSelect}
                          value={targetDeskId}
                          onChange={(e) => setTargetDeskId(e.target.value)}
                        >
                          <option value="">
                            {availableDesks.length > 0
                              ? `Select available desk to assign (${availableDesks.length} available)...`
                              : "No free desks available. Generate more in Venue & Desks."}
                          </option>
                          {Object.entries(desksByRoom).map(([roomName, roomDesks]) => (
                            <optgroup key={roomName} label={`📍 ${roomName} (${roomDesks.length} free)`}>
                              {roomDesks.map((d) => (
                                <option key={d.id} value={d.id}>
                                  Desk D{d.deskNumber} (Capacity: {d.capacity} builders)
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        className={styles.assignBtn}
                        onClick={() => handleDeskAssign(team.id, targetDeskId)}
                        disabled={!targetDeskId || assigningTeamId === team.id}
                      >
                        {assigningTeamId === team.id ? "Assigning..." : "⚡ Assign Desk"}
                      </button>

                      {team.desk && (
                        <button
                          type="button"
                          className={styles.releaseBtn}
                          onClick={() => handleDeskRelease(team.id)}
                          disabled={assigningTeamId === team.id}
                        >
                          Release Desk
                        </button>
                      )}

                      {/* Change Status Dropdown */}
                      <div className={styles.statusSelectWrapper}>
                        <span className={styles.statusSelectLabel}>Change Status:</span>
                        <select
                          value={team.status}
                          onChange={(e) => handleStatusChange(team.id, e.target.value)}
                          className={styles.allotmentSelect}
                          style={{ minWidth: 150 }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Project Pitch & Submission (if present) */}
                  {(team.problemStatement || team.projectDescription || team.projectName || team.githubUrl) && (
                    <div className={styles.dossierCard}>
                      <div className={styles.cardHeader}>
                        <div className={styles.cardHeaderTitle}>
                          <span>💡</span>
                          <span>Project Pitch &amp; Submission</span>
                        </div>
                        {team.projectName && (
                          <div className={styles.projectTitleBadge}>
                            {team.projectName}
                          </div>
                        )}
                      </div>

                      <div className={styles.projectDescriptionBox}>
                        <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                          {team.problemStatement || team.projectDescription || "No written statement submitted."}
                        </p>

                        <div className={styles.projectLinksRow}>
                          {team.githubUrl && (
                            <a
                              href={team.githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.assetLink}
                            >
                              <span>📦</span>
                              <span>GitHub Repository ↗</span>
                            </a>
                          )}
                          {team.pptUrl && (
                            <a
                              href={team.pptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.assetLink}
                            >
                              <span>📊</span>
                              <span>Pitch Deck / Slides ↗</span>
                            </a>
                          )}
                          {team.demoUrl && (
                            <a
                              href={team.demoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.assetLink}
                            >
                              <span>🎥</span>
                              <span>Live Demo ↗</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 3: Team Leader & Contact Dossier */}
                  <div className={styles.dossierCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <span>👑</span>
                        <span>Team Leader &amp; Primary Contact</span>
                      </div>
                      {team.college && (
                        <div className={styles.collegeTag}>
                          🏫 {team.college}
                        </div>
                      )}
                    </div>

                    <div className={styles.leaderGrid}>
                      <div className={styles.leaderField}>
                        <span className={styles.fieldLabel}>Leader Name</span>
                        <span className={styles.fieldValBold}>
                          {leaderData.name || team.members.find((m) => m.isLeader)?.name || "Team Leader"}
                        </span>
                      </div>

                      <div className={styles.leaderField}>
                        <span className={styles.fieldLabel}>Email Address</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <a href={`mailto:${team.leaderEmail}`} className={styles.accentLink}>
                            {team.leaderEmail || "—"}
                          </a>
                          {team.leaderEmail && (
                            <button
                              type="button"
                              onClick={() => copyText(team.leaderEmail!, "Leader Email")}
                              className={styles.microCopyBtn}
                              title="Copy email"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={styles.leaderField}>
                        <span className={styles.fieldLabel}>Phone &amp; Direct WhatsApp</span>
                        {team.leaderPhone ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <a href={`tel:${team.leaderPhone}`} style={{ color: "var(--color-ink)", fontWeight: 600 }}>
                              {team.leaderPhone}
                            </a>
                            <a
                              href={`https://wa.me/${team.leaderPhone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.whatsAppBtn}
                              title="Message leader on WhatsApp"
                            >
                              💬 WhatsApp
                            </a>
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </div>

                      {leaderData.departmentYear && (
                        <div className={styles.leaderField}>
                          <span className={styles.fieldLabel}>Department &amp; Year</span>
                          <span>{leaderData.departmentYear}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 4: Members Roster */}
                  <div className={styles.dossierCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <span>👥</span>
                        <span>
                          Team Members Roster ({rawMembers.length > 0 ? rawMembers.length : team.members.length} Members)
                        </span>
                      </div>
                    </div>

                    <div className={styles.membersGrid}>
                      {(rawMembers.length > 0 ? rawMembers : team.members).map((m: any, idx: number) => {
                        const isLeader = Boolean(m.isLeader ?? idx === 0);
                        return (
                          <div key={idx} className={styles.memberCard}>
                            <div className={styles.memberCardHeader}>
                              <span className={styles.memberName}>{m.name || `Member ${idx + 1}`}</span>
                              {isLeader && <span className={styles.leaderTag}>👑 LEADER</span>}
                            </div>
                            {m.email && <span className={styles.memberDetail}>✉️ {m.email}</span>}
                            {m.phone && (
                              <span className={styles.memberDetail}>
                                📞 <a href={`tel:${m.phone}`} style={{ color: "inherit" }}>{m.phone}</a>
                              </span>
                            )}
                            {m.college && <span className={styles.memberDetail}>🏫 {m.college}</span>}
                            {m.role && <span className={styles.memberRole}>{m.role}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 5: Payment Verification & QR Pass Token */}
                  <div className={styles.dossierCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <span>💳</span>
                        <span>Payment Verification &amp; Universal QR Pass</span>
                      </div>
                      {resp.utr && (
                        <span className={styles.verifiedBadge}>✓ UTR Verified</span>
                      )}
                    </div>

                    <div className={styles.paymentBox}>
                      <div className={styles.utrSection}>
                        <span className={styles.fieldLabel}>Transaction ID / UTR</span>
                        {resp.utr ? (
                          <div className={styles.utrRow}>
                            <span className={styles.utrCode}>{resp.utr}</span>
                            <button
                              type="button"
                              onClick={() => copyText(resp.utr, "Transaction ID")}
                              className={styles.copyPillBtn}
                            >
                              📋 Copy UTR
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "13px", color: "var(--color-ink-muted)" }}>
                            No payment transaction ID recorded.
                          </span>
                        )}
                      </div>

                      {resp.paymentScreenshot && (
                        <div className={styles.receiptSection}>
                          <span className={styles.fieldLabel}>Receipt Screenshot</span>
                          <div className={styles.receiptRow}>
                            <img
                              src={resp.paymentScreenshot}
                              alt="Payment Proof"
                              className={styles.proofThumb}
                              onClick={() => setSelectedReceiptUrl(resp.paymentScreenshot)}
                              title="Click to view full-size payment receipt"
                            />
                            <button
                              type="button"
                              className={styles.viewReceiptBtn}
                              onClick={() => setSelectedReceiptUrl(resp.paymentScreenshot)}
                            >
                              🔍 View Receipt Modal ↗
                            </button>
                          </div>
                        </div>
                      )}

                      <div className={styles.qrSection}>
                        <span className={styles.fieldLabel}>Universal Pass Token</span>
                        <div className={styles.qrTokenRow}>
                          <code className={styles.qrCodeText}>{team.qrToken.slice(0, 16)}...</code>
                          <button
                            type="button"
                            onClick={() => copyText(team.qrToken, "QR Pass Token")}
                            className={styles.copyPillBtn}
                          >
                            📋 Copy Token
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!loading && teams.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <h3 style={{ margin: "0 0 0.5rem", color: "var(--color-ink)", fontSize: "18px" }}>
              No teams found matching your query
            </h3>
            <p style={{ margin: 0, maxWidth: 460 }}>
              Try adjusting your search terms or clearing your status filters. You can also import teams from Google Forms, Sheets, or Excel.
            </p>
            <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setSeatingFilter("");
                  setSortBy("recent");
                  setQuickFilter("ALL");
                }}
              >
                Reset All Filters
              </button>
              <a href={`/events/${event.slug}/manage/import`} className={styles.primaryBtn}>
                📥 Import Teams
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Payment Receipt Lightbox Modal */}
      {selectedReceiptUrl && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReceiptUrl(null)}>
          <div className={styles.receiptModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.receiptModalHeader}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-ink)" }}>
                💳 Verified Payment Receipt
              </h3>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <a
                  href={selectedReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.secondaryBtn}
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                >
                  Open in New Tab ↗
                </a>
                <button
                  type="button"
                  className={styles.closeModalBtn}
                  onClick={() => setSelectedReceiptUrl(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.receiptModalBody}>
              <img
                src={selectedReceiptUrl}
                alt="Full Payment Proof"
                className={styles.fullReceiptImg}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
