"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "../manage.module.css";
import { useToast } from "@/components/ui";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  targetRole?: string | null;
  targetVenue?: string | null;
  targetTeamStatus?: string | null;
  createdAt: string;
}

interface RoomInfo {
  id: string;
  name: string;
}

export default function AnnouncementManager({ slug }: { slug: string }) {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [targetRole, setTargetRole] = useState<"ALL" | "PARTICIPANT" | "COORDINATOR" | "JUDGE">("ALL");
  const [targetVenue, setTargetVenue] = useState("");
  const [targetTeamStatus, setTargetTeamStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/announcements`);
      if (res.ok) {
        const json = await res.json();
        setAnnouncements(json.data || []);
      }
    } catch {
      // ignore
    }
  }, [slug]);

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/rooms`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.rooms)
          ? json.data.rooms
          : Array.isArray(json.rooms)
          ? json.rooms
          : [];
        setRooms(list);
      }
    } catch {
      setRooms([]);
    }
  }, [slug]);

  useEffect(() => {
    loadAnnouncements();
    loadRooms();
  }, [loadAnnouncements, loadRooms]);

  async function handleSend() {
    if (!title.trim() || !content.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/events/${slug}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          priority,
          targetRole,
          targetVenue: targetVenue || undefined,
          targetTeamStatus: targetTeamStatus === "ALL" ? undefined : targetTeamStatus,
        }),
      });

      if (res.ok) {
        toast.success("Broadcast alert dispatched to attendees!");
        setTitle("");
        setContent("");
        setPriority("NORMAL");
        setTargetRole("ALL");
        setTargetVenue("");
        setTargetTeamStatus("ALL");
        await loadAnnouncements();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || "Failed to broadcast announcement");
      }
    } catch {
      toast.error("Network error broadcasting alert");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.title}>Broadcast & Announcements</h1>
          <p className={styles.subtitle}>
            Push urgent operational alerts, room-targeted instructions, and status updates across the venue.
          </p>
        </div>
      </div>

      {/* Broadcast Form */}
      <div className={styles.createForm}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
            📣 Dispatch Live Broadcast
          </h3>
          <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            Real-time feed across participant & staff dashboards
          </span>
        </div>

        <input
          type="text"
          placeholder="Announcement Subject (e.g. Lunch served in Cafeteria B / Pitch Deck Upload Deadline in 30m)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={styles.input}
        />

        <textarea
          placeholder="Write the full broadcast message, instructions, links, or venue details..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={styles.textarea}
          rows={3}
        />

        {/* Multi-criteria targeting controls */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: 4 }}>
              PRIORITY LEVEL
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT")}
              className={styles.select}
              style={{ width: "100%" }}
            >
              <option value="LOW">🔵 Low (General Info)</option>
              <option value="NORMAL">🟢 Normal (Notice)</option>
              <option value="HIGH">🟡 High (Important)</option>
              <option value="URGENT">🚨 Urgent (Immediate Attention)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: 4 }}>
              TARGET AUDIENCE
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as "ALL" | "PARTICIPANT" | "COORDINATOR" | "JUDGE")}
              className={styles.select}
              style={{ width: "100%" }}
            >
              <option value="ALL">👥 Everyone (All Attendees)</option>
              <option value="PARTICIPANT">🎓 Participants Only</option>
              <option value="COORDINATOR">🛡️ Coordinators & Staff</option>
              <option value="JUDGE">⚖️ Judges Only</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: 4 }}>
              VENUE ROOM (OPTIONAL)
            </label>
            <select
              value={targetVenue}
              onChange={(e) => setTargetVenue(e.target.value)}
              className={styles.select}
              style={{ width: "100%" }}
            >
              <option value="">🏢 All Venue Rooms</option>
              {Array.isArray(rooms) && rooms.map((rm) => (
                <option key={rm.id} value={rm.name}>
                  {rm.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: 4 }}>
              TEAM STATUS (OPTIONAL)
            </label>
            <select
              value={targetTeamStatus}
              onChange={(e) => setTargetTeamStatus(e.target.value)}
              className={styles.select}
              style={{ width: "100%" }}
            >
              <option value="ALL">✨ All Teams</option>
              <option value="SHORTLISTED">⭐ Shortlisted / Advancing Only</option>
              <option value="ELIMINATED">🏁 Completed / Eliminated</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={handleSend}
            disabled={loading || !title.trim() || !content.trim()}
            className={styles.primaryBtn}
          >
            {loading ? "Broadcasting..." : "Broadcast Alert →"}
          </button>
        </div>
      </div>

      {/* Announcements Feed */}
      <div className={styles.listSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
            Past Broadcasts ({announcements.length})
          </h3>
          <button onClick={loadAnnouncements} className={styles.secondaryBtn} style={{ fontSize: 12 }}>
            🔄 Refresh
          </button>
        </div>

        {announcements.map((a) => (
          <div
            key={a.id}
            className={`${styles.annCard} ${a.priority === "URGENT" ? styles.annUrgent : ""}`}
            style={{
              background: "var(--color-surface-1)",
              borderColor: a.priority === "URGENT" ? "#ef4444" : "var(--color-hairline)",
              boxShadow: "var(--shadow-sm)",
              padding: "16px",
              borderRadius: "var(--rounded-lg)",
            }}
          >
            <div className={styles.annHeader} style={{ flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <strong style={{ color: "var(--color-ink)", fontSize: "15px" }}>{a.title}</strong>
                {a.priority === "URGENT" && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#ef4444",
                      padding: "2px 8px",
                      borderRadius: "var(--rounded-pill)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    🚨 URGENT
                  </span>
                )}
                {a.targetRole && a.targetRole !== "ALL" && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "var(--color-surface-2)",
                      color: "var(--color-ink-muted)",
                      padding: "2px 8px",
                      borderRadius: "var(--rounded-pill)",
                      border: "1px solid var(--color-hairline)",
                    }}
                  >
                    Target: {a.targetRole}
                  </span>
                )}
                {a.targetVenue && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(99, 102, 241, 0.1)",
                      color: "var(--color-accent, #6366f1)",
                      padding: "2px 8px",
                      borderRadius: "var(--rounded-pill)",
                    }}
                  >
                    Room: {a.targetVenue}
                  </span>
                )}
              </div>
              <span className={styles.annTime}>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
            <p className={styles.annContent} style={{ marginTop: 8, whiteSpace: "pre-line" }}>
              {a.content}
            </p>
          </div>
        ))}

        {announcements.length === 0 && (
          <div className={styles.emptyState}>
            No announcements sent yet. Use the form above to broadcast live operational updates.
          </div>
        )}
      </div>
    </div>
  );
}
