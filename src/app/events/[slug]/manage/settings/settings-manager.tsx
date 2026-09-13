"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";

interface EventData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  minTeamSize: number;
  maxTeamSize: number;
  maxTeams: number | null;
  winnersCount: number;
  registrationMethod: "NATIVE" | "EXTERNAL";
  externalFormUrl: string | null;
  googleSheetUrl?: string | null;
  autoSyncEnabled?: boolean;
  syncIntervalMinutes?: number;
  participantNotice?: string | null;
  eventStarts: string | Date | null;
  eventEnds: string | Date | null;
  registrationOpens?: string | Date | null;
  registrationCloses?: string | Date | null;
}

interface Invitation {
  id: string;
  token: string;
  role: "COORDINATOR" | "JUDGE";
  usedCount: number;
  maxUses: number | null;
  expiresAt: string;
  createdAt: string;
}

interface StaffMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
  lastActiveAt: string | null;
  actionsCount: number;
}

export default function EventSettingsManager({ event }: { event: EventData }) {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"config" | "staff" | "exports">("config");

  // Form State
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [status, setStatus] = useState(event.status);
  const [minTeamSize, setMinTeamSize] = useState(event.minTeamSize);
  const [maxTeamSize, setMaxTeamSize] = useState(event.maxTeamSize);
  const [maxTeams, setMaxTeams] = useState<string>(event.maxTeams ? String(event.maxTeams) : "");
  const [winnersCount, setWinnersCount] = useState(event.winnersCount || 3);
  const [regMethod, setRegMethod] = useState<"NATIVE" | "EXTERNAL">(event.registrationMethod || "NATIVE");
  const [externalUrl, setExternalUrl] = useState(event.externalFormUrl || "");
  const [googleSheetUrl, setGoogleSheetUrl] = useState(event.googleSheetUrl || "");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(event.autoSyncEnabled || false);
  const [syncInterval, setSyncInterval] = useState(event.syncIntervalMinutes || 15);
  const [participantNotice, setParticipantNotice] = useState(event.participantNotice || "");
  const [eventStarts, setEventStarts] = useState(
    event.eventStarts ? new Date(event.eventStarts).toISOString().slice(0, 16) : ""
  );
  const [eventEnds, setEventEnds] = useState(
    event.eventEnds ? new Date(event.eventEnds).toISOString().slice(0, 16) : ""
  );

  const [saving, setSaving] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);

  // Staff & Invitations State
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [inviteRole, setInviteRole] = useState<"JUDGE" | "COORDINATOR">("JUDGE");
  const [inviteMaxUses, setInviteMaxUses] = useState<string>("");
  const [inviteHours, setInviteHours] = useState<number>(168); // 7 days
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.slug}/invitations`);
      if (res.ok) {
        const json = await res.json();
        setInvitations(json.data || []);
      }
    } catch {
      // ignore
    }
  }, [event.slug]);

  const fetchStaffPresence = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/staff/heartbeat`);
      if (res.ok) {
        const json = await res.json();
        setStaffList(json.data?.staff || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStaff(false);
    }
  }, [event.slug]);

  useEffect(() => {
    if (activeTab === "staff") {
      fetchInvitations();
      fetchStaffPresence();
    }
  }, [activeTab, fetchInvitations, fetchStaffPresence]);

  // Save Event Configuration
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        minTeamSize: Number(minTeamSize),
        maxTeamSize: Number(maxTeamSize),
        maxTeams: maxTeams ? Number(maxTeams) : null,
        winnersCount: Number(winnersCount),
        registrationMethod: regMethod,
        externalFormUrl: regMethod === "EXTERNAL" ? externalUrl.trim() || null : null,
        googleSheetUrl: googleSheetUrl.trim() || null,
        autoSyncEnabled,
        syncIntervalMinutes: Number(syncInterval),
        participantNotice: participantNotice.trim() || null,
        eventStarts: eventStarts ? new Date(eventStarts).toISOString() : null,
        eventEnds: eventEnds ? new Date(eventEnds).toISOString() : null,
      };

      const res = await fetch(`/api/events/${event.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        toast.success("Event configuration saved successfully!");
        router.refresh();
      } else {
        toast.error(json.error || "Failed to update configuration");
      }
    } catch {
      toast.error("Network error saving configuration");
    } finally {
      setSaving(false);
    }
  }

  // Trigger Sheet Sync
  async function handleTriggerSync() {
    if (!googleSheetUrl.trim()) {
      toast.error("Please provide a valid Google Sheet URL first");
      return;
    }
    setSyncingSheet(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/form-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleSheetUrl: googleSheetUrl.trim(),
          autoSync: autoSyncEnabled,
          syncInterval: Number(syncInterval),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Sync complete! ${json.stats?.created || 0} teams added, ${json.stats?.updated || 0} updated.`);
      } else {
        toast.error(json.error || "Form synchronization failed");
      }
    } catch {
      toast.error("Network error syncing Google Sheet");
    } finally {
      setSyncingSheet(false);
    }
  }

  // Create Staff Invitation
  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingInvite(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: inviteRole,
          maxUses: inviteMaxUses ? Number(inviteMaxUses) : undefined,
          expiresInHours: inviteHours,
        }),
      });

      if (res.ok) {
        await fetchInvitations();
        setInviteMaxUses("");
        toast.success("Staff invitation link generated!");
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || "Failed to create invitation");
      }
    } finally {
      setGeneratingInvite(false);
    }
  }

  function copyInviteLink(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Invitation link copied to clipboard!");
    setTimeout(() => setCopiedToken(null), 2500);
  }

  // Design Token Styles
  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface-1)",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--rounded-xl)",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    boxShadow: "var(--shadow-sm)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--color-ink-muted)",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--rounded-md)",
    color: "var(--color-ink)",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
  };

  const primaryBtnStyle: React.CSSProperties = {
    background: "var(--color-inverse-canvas)",
    color: "var(--color-on-primary)",
    border: "none",
    padding: "10px 20px",
    borderRadius: "var(--rounded-pill)",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s ease",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    background: "var(--color-surface-2)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline)",
    padding: "8px 16px",
    borderRadius: "var(--rounded-pill)",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  };

  return (
    <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-ink)", letterSpacing: "-1px", margin: 0 }}>
          ⚙️ Event Configuration & Staff
        </h1>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "14px", marginTop: "4px", marginBottom: 0 }}>
          Manage event constraints, automated Google Sheet sync, live staff monitoring, and data exports.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--color-hairline)", paddingBottom: "8px" }}>
        <button
          onClick={() => setActiveTab("config")}
          style={{
            background: activeTab === "config" ? "var(--color-surface-1)" : "transparent",
            color: activeTab === "config" ? "var(--color-accent, #6366f1)" : "var(--color-ink-muted)",
            border: activeTab === "config" ? "1px solid var(--color-hairline)" : "1px solid transparent",
            borderBottom: activeTab === "config" ? "2px solid var(--color-accent, #6366f1)" : "none",
            padding: "8px 16px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          ⚙️ Event & Form Settings
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          style={{
            background: activeTab === "staff" ? "var(--color-surface-1)" : "transparent",
            color: activeTab === "staff" ? "var(--color-accent, #6366f1)" : "var(--color-ink-muted)",
            border: activeTab === "staff" ? "1px solid var(--color-hairline)" : "1px solid transparent",
            borderBottom: activeTab === "staff" ? "2px solid var(--color-accent, #6366f1)" : "none",
            padding: "8px 16px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          👥 Staff Presence & Invites ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab("exports")}
          style={{
            background: activeTab === "exports" ? "var(--color-surface-1)" : "transparent",
            color: activeTab === "exports" ? "var(--color-accent, #6366f1)" : "var(--color-ink-muted)",
            border: activeTab === "exports" ? "1px solid var(--color-hairline)" : "1px solid transparent",
            borderBottom: activeTab === "exports" ? "2px solid var(--color-accent, #6366f1)" : "none",
            padding: "8px 16px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          ⚡ Unified 32-Col Data Exports
        </button>
      </div>

      {/* TAB 1: CONFIGURATION */}
      {activeTab === "config" && (
        <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* General Information */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              General Information & Lifecycle
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Event Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Description / Theme Summary</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Event Lifecycle Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="DRAFT">📝 DRAFT — Setup & Internal Configuration</option>
                    <option value="REGISTRATION_OPEN">📥 REGISTRATION_OPEN — Accepting Teams</option>
                    <option value="REGISTRATION_CLOSED">🔒 REGISTRATION_CLOSED — Roster Finalized</option>
                    <option value="EVENT_READY">🏢 EVENT_READY — Desks & Check-in Open</option>
                    <option value="ROUND_ACTIVE">⚖️ ROUND_ACTIVE — Hackathon in Progress</option>
                    <option value="EVENT_COMPLETED">🏆 EVENT_COMPLETED — Finished & Awards</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Winners Threshold</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={winnersCount}
                    onChange={(e) => setWinnersCount(Number(e.target.value))}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: "11px", color: "var(--color-ink-muted)", marginTop: "3px", display: "block" }}>
                    Determines top rankings for automated certificates
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Participant Notice Banner */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              📢 Participant Notice (Top of Participant Dashboard)
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: 0 }}>
              A prominent banner message displayed to all logged-in participants at the top of their dashboard (e.g. WiFi credentials, dinner timing, or submission reminders).
            </p>
            <textarea
              rows={2}
              placeholder="e.g. WiFi SSID: HackathonGuest (Pass: Innovate2026). Pitch deck submission closes at 11:30 PM sharp!"
              value={participantNotice}
              onChange={(e) => setParticipantNotice(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Registration & Google Sheet Sync */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              📊 Registration & Google Sheets Live Sync
            </h3>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: 0 }}>
              Connect your Google Form response spreadsheet. All 32+ columns (members 1-5, college, UTR, payment proof) will be continuously parsed and extracted.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Registration Method</label>
                <select
                  value={regMethod}
                  onChange={(e) => setRegMethod(e.target.value as "NATIVE" | "EXTERNAL")}
                  style={inputStyle}
                >
                  <option value="NATIVE">Native HackFlow Form Registration</option>
                  <option value="EXTERNAL">External Google Form / Spreadsheet Sync</option>
                </select>
              </div>

              {regMethod === "EXTERNAL" && (
                <div>
                  <label style={labelStyle}>External Form Link</label>
                  <input
                    type="url"
                    placeholder="https://forms.gle/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
              <label style={labelStyle}>Live Google Sheet Spreadsheet URL</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: "260px" }}
                />
                <button
                  type="button"
                  onClick={handleTriggerSync}
                  disabled={syncingSheet || !googleSheetUrl.trim()}
                  style={secondaryBtnStyle}
                >
                  {syncingSheet ? "Syncing..." : "🔄 Test & Sync Now"}
                </button>
              </div>
              <span style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
                Sheet must be shared as &quot;Anyone with the link can view&quot;. HackFlow converts it into live CSV stream automatically.
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", background: "var(--color-surface-2)", padding: "12px", borderRadius: "var(--rounded-md)" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-ink)" }}>
                  Auto-Sync Sheet in Background
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
                  Periodically poll Google Sheets for new team registrations and payment UTR updates.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  disabled={!autoSyncEnabled}
                  style={{ ...inputStyle, width: "auto" }}
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour</option>
                </select>
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
              </div>
            </div>
          </div>

          {/* Constraints & Schedule */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              Team Constraints & Event Schedule
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Min Team Size</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={minTeamSize}
                  onChange={(e) => setMinTeamSize(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Max Team Size</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxTeamSize}
                  onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Max Teams Cap (Optional)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "8px" }}>
              <div>
                <label style={labelStyle}>Event Starts At</label>
                <input
                  type="datetime-local"
                  value={eventStarts}
                  onChange={(e) => setEventStarts(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Event Ends At</label>
                <input
                  type="datetime-local"
                  value={eventEnds}
                  onChange={(e) => setEventEnds(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={saving}
              style={primaryBtnStyle}
            >
              {saving ? "Saving Changes..." : "💾 Save Event Configuration"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: STAFF PRESENCE & INVITATIONS */}
      {activeTab === "staff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Live Staff Presence Table */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                  🛡️ Active Staff & Scanner Presence
                </h3>
                <span style={{ fontSize: "13px", color: "var(--color-ink-muted)" }}>
                  Real-time status of coordinators scanning badges and judges scoring teams
                </span>
              </div>
              <button onClick={fetchStaffPresence} style={secondaryBtnStyle}>
                🔄 Refresh Presence
              </button>
            </div>

            {loadingStaff ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--color-ink-muted)" }}>
                Loading staff roster...
              </div>
            ) : staffList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "var(--color-ink-muted)", border: "1px dashed var(--color-hairline)", borderRadius: "var(--rounded-md)" }}>
                No staff members registered yet. Generate an invitation link below to invite Coordinators and Judges.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-hairline)",
                      borderRadius: "var(--rounded-md)",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: st.isOnline ? "#10b981" : "var(--color-hairline)",
                          boxShadow: st.isOnline ? "0 0 8px #10b981" : "none",
                        }}
                      />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-ink)" }}>
                          {st.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
                          {st.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "var(--rounded-pill)",
                          fontSize: "11px",
                          fontWeight: 700,
                          background:
                            st.role === "JUDGE"
                              ? "rgba(139, 92, 246, 0.15)"
                              : st.role === "COORDINATOR"
                              ? "rgba(16, 185, 129, 0.15)"
                              : "var(--color-surface-1)",
                          color:
                            st.role === "JUDGE"
                              ? "#8b5cf6"
                              : st.role === "COORDINATOR"
                              ? "#10b981"
                              : "var(--color-ink)",
                          border: "1px solid var(--color-hairline)",
                        }}
                      >
                        {st.role}
                      </span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-ink)" }}>
                          {st.actionsCount} actions
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}>
                          {st.isOnline ? "Active Now" : st.lastActiveAt ? `Seen ${new Date(st.lastActiveAt).toLocaleTimeString()}` : "Offline"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate Staff Invitation */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              + Generate Staff Invitation Link
            </h3>

            <form
              onSubmit={handleCreateInvitation}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", alignItems: "flex-end" }}
            >
              <div>
                <label style={labelStyle}>Staff Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "JUDGE" | "COORDINATOR")}
                  style={inputStyle}
                >
                  <option value="JUDGE">⚖️ Judge (Evaluate & Score)</option>
                  <option value="COORDINATOR">🎫 Coordinator (Scan QR & Attendance)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Max Uses (Optional)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Validity Period</label>
                <select
                  value={inviteHours}
                  onChange={(e) => setInviteHours(Number(e.target.value))}
                  style={inputStyle}
                >
                  <option value={24}>24 Hours</option>
                  <option value={72}>3 Days</option>
                  <option value={168}>7 Days (1 Week)</option>
                  <option value={720}>30 Days</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={generatingInvite}
                style={primaryBtnStyle}
              >
                {generatingInvite ? "Generating..." : "+ Create Link"}
              </button>
            </form>

            {/* Invitations List */}
            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-ink)", marginBottom: "8px" }}>
                Active Invitations ({invitations.length})
              </div>

              {invitations.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--color-ink-muted)", border: "1px dashed var(--color-hairline)", borderRadius: "var(--rounded-md)" }}>
                  No active invitations. Create an invite above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-hairline)",
                        borderRadius: "var(--rounded-md)",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "var(--rounded-pill)",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: inv.role === "JUDGE" ? "rgba(139, 92, 246, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: inv.role === "JUDGE" ? "#8b5cf6" : "#10b981",
                          }}
                        >
                          {inv.role}
                        </span>
                        <div>
                          <div style={{ fontSize: "13px", color: "var(--color-ink)", fontFamily: "monospace" }}>
                            Token: {inv.token.substring(0, 18)}...
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}>
                            Used {inv.usedCount} {inv.maxUses ? `/ ${inv.maxUses}` : ""} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => copyInviteLink(inv.token)}
                        style={secondaryBtnStyle}
                      >
                        {copiedToken === inv.token ? "✓ Copied!" : "📋 Copy URL"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: UNIFIED EXPORTS */}
      {activeTab === "exports" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div style={cardStyle}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-ink)" }}>
              📋 Teams Complete Roster (32+ Columns)
            </h4>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: 0 }}>
              Full dossier including leader phone & WhatsApp, members 2-5, college, department, payment UTR, payment proof link, and assigned desk.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <a
                href={`/api/events/${event.slug}/export?type=teams&format=csv`}
                download
                style={{ ...secondaryBtnStyle, textDecoration: "none" }}
              >
                ⬇ Download CSV
              </a>
              <a
                href={`/api/events/${event.slug}/export?type=teams&format=xlsx`}
                download
                style={{ ...secondaryBtnStyle, textDecoration: "none" }}
              >
                ⬇ Download Excel (.xlsx)
              </a>
            </div>
          </div>

          <div style={cardStyle}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-ink)" }}>
              👥 Individual Participant Directory
            </h4>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: 0 }}>
              Flattened directory of every individual participant across all registered teams with check-in timestamp and contact email.
            </p>
            <div style={{ marginTop: "auto" }}>
              <a
                href={`/api/events/${event.slug}/export?type=participants`}
                download
                style={{ ...secondaryBtnStyle, textDecoration: "none" }}
              >
                ⬇ Download Participants CSV
              </a>
            </div>
          </div>

          <div style={cardStyle}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-ink)" }}>
              🏢 Venue & Desk Allocations
            </h4>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: 0 }}>
              Complete mapping of physical rooms, desk numbers, team IDs, capacity, and current check-in presence.
            </p>
            <div style={{ marginTop: "auto" }}>
              <a
                href={`/api/events/${event.slug}/export?type=venue`}
                download
                style={{ ...secondaryBtnStyle, textDecoration: "none" }}
              >
                ⬇ Download Venue Desks CSV
              </a>
            </div>
          </div>

          <div style={cardStyle}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-ink)" }}>
              📜 Certificates & Awards
            </h4>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: 0 }}>
              List of generated certificates, verification URLs, winner placements, and recipient details.
            </p>
            <div style={{ marginTop: "auto" }}>
              <a
                href={`/api/events/${event.slug}/export?type=certificates`}
                download
                style={{ ...secondaryBtnStyle, textDecoration: "none" }}
              >
                ⬇ Download Certificates CSV
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
