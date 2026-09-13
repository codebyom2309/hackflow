"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast, ConfirmModal } from "@/components/ui";
import styles from "./venue.module.css";

interface Room {
  id: string;
  name: string;
  roomNumber: number;
  isActive: boolean;
  totalDesks: number;
  allocatedDesks: number;
  availableDesks: number;
  totalCapacity: number;
}

interface VenueStats {
  totalRooms: number;
  activeRooms: number;
  totalDesks: number;
  allocatedDesks: number;
  availableDesks: number;
  totalCapacity: number;
  occupancyRate: number;
}

interface Desk {
  id: string;
  deskNumber: number;
  capacity: number;
  isAllocated: boolean;
  team: { id: string; name: string; memberCount: number } | null;
}

interface VenueManagerProps {
  eventSlug: string;
  initialRooms: Room[];
  initialStats: VenueStats;
}

export default function VenueManager({
  eventSlug,
  initialRooms,
  initialStats,
}: VenueManagerProps) {
  const router = useRouter();
  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>(initialRooms || []);
  const [stats, setStats] = useState(initialStats);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [loadingDesks, setLoadingDesks] = useState(false);

  // Add room state
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);

  // Bulk desk state
  const [showBulkDesks, setShowBulkDesks] = useState(false);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkCapacity, setBulkCapacity] = useState(4);
  const [creatingDesks, setCreatingDesks] = useState(false);

  // Auto-allot
  const [autoAllotting, setAutoAllotting] = useState(false);

  // Selected desk & reassignment state
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [reassignDeskId, setReassignDeskId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignMsg, setReassignMsg] = useState("");

  // Unseated teams state for single-desk assignment
  const [unseatedTeams, setUnseatedTeams] = useState<
    Array<{ id: string; name: string; memberCount: number; leaderEmail?: string | null; college?: string | null }>
  >([]);
  const [loadingUnseated, setLoadingUnseated] = useState(false);
  const [selectedTeamToAssign, setSelectedTeamToAssign] = useState("");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [assigningDesk, setAssigningDesk] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);

  const refreshRoomsAndStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventSlug}/rooms`);
      if (res.ok) {
        const json = await res.json();
        const rList = Array.isArray(json.data) ? json.data : (json.data?.rooms || []);
        setRooms(rList);
        if (json.data?.stats) setStats(json.data.stats);
      }
    } catch {
      // ignore
    }
  }, [eventSlug]);

  const loadUnseatedTeams = useCallback(async () => {
    setLoadingUnseated(true);
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks?unseated=true`);
      if (res.ok) {
        const { data } = await res.json();
        setUnseatedTeams(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUnseated(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    loadUnseatedTeams();
  }, [loadUnseatedTeams]);

  // Single desk allocation
  async function handleAssignDesk() {
    if (!selectedDesk || !selectedTeamToAssign || assigningDesk) return;
    setAssigningDesk(true);
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          teamId: selectedTeamToAssign,
          deskId: selectedDesk.id,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Desk D${selectedDesk.deskNumber} successfully assigned!`);
        setSelectedDesk(null);
        setSelectedTeamToAssign("");
        if (selectedRoom) await loadDesks(selectedRoom);
        await loadUnseatedTeams();
        await refreshRoomsAndStats();
        refresh();
      } else {
        toast.error(json.error || "Failed to assign desk");
      }
    } catch {
      toast.error("Network error allocating desk");
    } finally {
      setAssigningDesk(false);
    }
  }

  // Fetch desks for a room
  async function loadDesks(room: Room) {
    setSelectedRoom(room);
    setLoadingDesks(true);
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks?roomId=${room.id}`);
      if (res.ok) {
        const { data } = await res.json();
        setDesks(data);
      }
    } finally {
      setLoadingDesks(false);
    }
  }

  // Add room
  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim() || addingRoom) return;
    setAddingRoom(true);
    try {
      const res = await fetch(`/api/events/${eventSlug}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName.trim(),
          roomNumber: rooms.length + 1,
        }),
      });
      if (res.ok) {
        setNewRoomName("");
        setShowAddRoom(false);
        refresh();
      }
    } finally {
      setAddingRoom(false);
    }
  }

  // Bulk create desks
  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom || creatingDesks) return;
    setCreatingDesks(true);
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          count: bulkCount,
          capacity: bulkCapacity,
          startNumber: selectedRoom.totalDesks + 1,
        }),
      });
      if (res.ok) {
        setShowBulkDesks(false);
        await loadDesks(selectedRoom);
        refresh();
      }
    } finally {
      setCreatingDesks(false);
    }
  }

  const [confirmRelease, setConfirmRelease] = useState(false);

  // Auto-allot
  async function handleAutoAllot() {
    if (autoAllotting) return;
    setAutoAllotting(true);
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks/auto-allot`, {
        method: "POST",
      });
      if (res.ok) {
        const { data } = await res.json();
        toast.success(`Allocated ${data.allocated} of ${data.total} unseated teams`);
        await loadUnseatedTeams();
        if (selectedRoom) await loadDesks(selectedRoom);
        await refreshRoomsAndStats();
        refresh();
      } else {
        const errJson = await res.json();
        toast.error(errJson.error || "Auto-allot failed");
      }
    } catch {
      toast.error("Network error during auto-allot");
    } finally {
      setAutoAllotting(false);
    }
  }

  // Reassign team to another desk
  async function handleReassign() {
    if (!selectedDesk?.team || !reassignDeskId || reassigning) return;
    setReassigning(true);
    setReassignMsg("");
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign",
          teamId: selectedDesk.team.id,
          newDeskId: reassignDeskId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Team reassigned to new desk successfully!`);
        setSelectedDesk(null);
        setReassignDeskId("");
        if (selectedRoom) await loadDesks(selectedRoom);
        await loadUnseatedTeams();
        await refreshRoomsAndStats();
        refresh();
      } else {
        setReassignMsg(json.error || "Failed to reassign");
        toast.error(json.error || "Failed to reassign desk");
      }
    } catch {
      toast.error("Network error reassigning desk");
    } finally {
      setReassigning(false);
    }
  }

  // Release desk
  function handleRelease() {
    if (!selectedDesk?.team || reassigning) return;
    setConfirmRelease(true);
  }

  async function executeRelease() {
    if (!selectedDesk?.team) return;
    setConfirmRelease(false);
    setReassigning(true);
    setReassignMsg("");
    try {
      const res = await fetch(`/api/events/${eventSlug}/desks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release",
          teamId: selectedDesk.team.id,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Desk D${selectedDesk.deskNumber} released successfully`);
        setSelectedDesk(null);
        if (selectedRoom) await loadDesks(selectedRoom);
        await loadUnseatedTeams();
        await refreshRoomsAndStats();
        refresh();
      } else {
        setReassignMsg(json.error || "Failed to release");
        toast.error(json.error || "Failed to release");
      }
    } catch {
      toast.error("Network error releasing desk");
    } finally {
      setReassigning(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Venue Management</h1>
          <p className={styles.subtitle}>
            {stats.totalRooms} rooms · {stats.totalDesks} desks ·{" "}
            {stats.occupancyRate.toFixed(0)}% occupied
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.autoAllotBtn}
            onClick={handleAutoAllot}
            disabled={autoAllotting}
          >
            {autoAllotting ? "Allocating..." : "⚡ Auto-Allot Remaining"}
          </button>
          <button
            className={styles.addRoomBtn}
            onClick={() => setShowAddRoom(true)}
          >
            + Add Room
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalRooms}</span>
          <span className={styles.statLabel}>Rooms</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalDesks}</span>
          <span className={styles.statLabel}>Total Desks</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {stats.availableDesks}
          </span>
          <span className={styles.statLabel}>Available</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statValue} ${styles.statRed}`}>
            {stats.allocatedDesks}
          </span>
          <span className={styles.statLabel}>Allocated</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalCapacity}</span>
          <span className={styles.statLabel}>Total Capacity</span>
        </div>
      </div>

      {/* Room Grid */}
      <div className={styles.roomGrid}>
        {rooms.map((room) => {
          const pct =
            room.totalDesks > 0
              ? (room.allocatedDesks / room.totalDesks) * 100
              : 0;
          return (
            <button
              key={room.id}
              className={`${styles.roomCard} ${
                selectedRoom?.id === room.id ? styles.roomCardActive : ""
              } ${!room.isActive ? styles.roomCardInactive : ""}`}
              onClick={() => loadDesks(room)}
            >
              <div className={styles.roomHeader}>
                <h3 className={styles.roomName}>{room.name}</h3>
                <span
                  className={`${styles.roomStatus} ${
                    room.isActive ? styles.roomActive : styles.roomDisabled
                  }`}
                >
                  {room.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className={styles.occupancyBar}>
                <div
                  className={styles.occupancyFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={styles.roomMeta}>
                <span>{room.allocatedDesks}/{room.totalDesks} desks</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desk Detail Panel */}
      {selectedRoom && (
        <div className={styles.deskPanel}>
          <div className={styles.deskPanelHeader}>
            <h2 className={styles.deskPanelTitle}>{selectedRoom.name}</h2>
            <button
              className={styles.generateBtn}
              onClick={() => setShowBulkDesks(true)}
            >
              + Generate Desks
            </button>
          </div>

          {loadingDesks ? (
            <p className={styles.loading}>Loading desks...</p>
          ) : desks.length === 0 ? (
            <div className={styles.emptyDesks}>
              <p>No desks yet. Generate some to get started.</p>
            </div>
          ) : (
            <div className={styles.deskGrid}>
              {desks.map((desk) => (
                <div
                  key={desk.id}
                  onClick={() => {
                    setSelectedDesk(desk);
                    setReassignDeskId("");
                    setReassignMsg("");
                    setSelectedTeamToAssign("");
                    setTeamSearchQuery("");
                    if (!desk.isAllocated) {
                      loadUnseatedTeams();
                    }
                  }}
                  className={`${styles.deskCell} ${
                    desk.isAllocated ? styles.deskFilled : styles.deskAvailable
                  }`}
                  title={
                    desk.team
                      ? `${desk.team.name} (${desk.team.memberCount} members) — Click to view / reassign`
                      : `Desk ${desk.deskNumber} — Available (Cap: ${desk.capacity})`
                  }
                >
                  <span className={styles.deskNumber}>D{desk.deskNumber}</span>
                  <span className={styles.deskCapacity}>×{desk.capacity}</span>
                  {desk.team && (
                    <span className={styles.deskTeam}>{desk.team.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unseated Teams Queue */}
      <div style={{
        marginTop: "1.5rem",
        padding: "1.25rem 1.5rem",
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--rounded-xl)",
        backdropFilter: "var(--glass-blur)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              ⏳ Unseated Teams Awaiting Desk ({unseatedTeams.length})
            </h3>
            {unseatedTeams.length === 0 && (
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-success)", background: "rgba(52, 211, 153, 0.15)", padding: "2px 8px", borderRadius: 99 }}>
                ✓ All Teams Seated
              </span>
            )}
          </div>
          {unseatedTeams.length > 0 && (
            <button
              onClick={handleAutoAllot}
              disabled={autoAllotting}
              className={styles.autoAllotBtn}
              style={{ fontSize: "12px", padding: "6px 14px" }}
            >
              {autoAllotting ? "Allocating..." : "⚡ Auto-Allot Remaining"}
            </button>
          )}
        </div>

        {unseatedTeams.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.6rem" }}>
            {unseatedTeams.slice(0, 12).map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "0.7rem 0.9rem",
                  borderRadius: 8,
                  background: "var(--color-surface-1)",
                  border: "1px solid var(--color-hairline)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}>
                    👥 {t.memberCount} members · {t.leaderEmail || "No email"}
                  </div>
                </div>
              </div>
            ))}
            {unseatedTeams.length > 12 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-ink-muted)", fontSize: "12px" }}>
                + {unseatedTeams.length - 12} more teams waiting
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "var(--color-ink-muted)", fontSize: "13px", margin: 0 }}>
            Every registered team currently has a designated desk. Click any available green desk above to manually assign teams.
          </p>
        )}
      </div>

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className={styles.overlay} onClick={() => setShowAddRoom(false)}>
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddRoom}
          >
            <h2 className={styles.modalTitle}>Add Room</h2>
            <input
              type="text"
              className={styles.input}
              placeholder="Room name (e.g., Hall A)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              autoFocus
              required
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowAddRoom(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={addingRoom || !newRoomName.trim()}
              >
                {addingRoom ? "Adding..." : "Add Room"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Desk Generation Modal */}
      {showBulkDesks && selectedRoom && (
        <div className={styles.overlay} onClick={() => setShowBulkDesks(false)}>
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleBulkCreate}
          >
            <h2 className={styles.modalTitle}>
              Generate Desks — {selectedRoom.name}
            </h2>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Number of Desks</label>
                <input
                  type="number"
                  className={styles.input}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  min={1}
                  max={200}
                  required
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Capacity per Desk</label>
                <input
                  type="number"
                  className={styles.input}
                  value={bulkCapacity}
                  onChange={(e) => setBulkCapacity(Number(e.target.value))}
                  min={1}
                  max={20}
                  required
                />
              </div>
            </div>
            <p className={styles.formHint}>
              This will create {bulkCount} desks starting from D
              {selectedRoom.totalDesks + 1}, each seating {bulkCapacity} people.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowBulkDesks(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={creatingDesks}
              >
                {creatingDesks ? "Creating..." : `Generate ${bulkCount} Desks`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Desk Details / Reassignment Modal */}
      {selectedDesk && (
        <div className={styles.overlay} onClick={() => setSelectedDesk(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              Desk D{selectedDesk.deskNumber}
            </h2>
            <div style={{ marginBottom: "1rem", color: "var(--color-ink-muted)", fontSize: "14px" }}>
              Room: <strong>{selectedRoom?.name}</strong> · Capacity: <strong>{selectedDesk.capacity} members</strong>
            </div>

            {reassignMsg && (
              <div style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.15)",
                color: "#f87171",
                fontSize: "13px",
                marginBottom: "1rem",
              }}>
                {reassignMsg}
              </div>
            )}

            {selectedDesk.team ? (
              <div>
                <div style={{
                  padding: "1rem",
                  borderRadius: 10,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-hairline)",
                  marginBottom: "1.25rem",
                }}>
                  <div style={{ fontSize: "12px", color: "var(--color-ink-muted)", textTransform: "uppercase" }}>
                    Currently Allocated Team
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-ink)", margin: "4px 0" }}>
                    {selectedDesk.team.name}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--color-ink-muted)" }}>
                    👥 {selectedDesk.team.memberCount} members
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label className={styles.formLabel} style={{ display: "block", marginBottom: 6 }}>
                    Reassign to another available desk in this room:
                  </label>
                  <select
                    className={styles.input}
                    value={reassignDeskId}
                    onChange={(e) => setReassignDeskId(e.target.value)}
                  >
                    <option value="">Select available desk...</option>
                    {desks
                      .filter((d) => !d.isAllocated && d.id !== selectedDesk.id && d.capacity >= (selectedDesk.team?.memberCount || 1))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          Desk D{d.deskNumber} (Cap: {d.capacity})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleRelease}
                    disabled={reassigning}
                    style={{
                      padding: "8px 16px",
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      borderRadius: "var(--rounded-pill)",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: reassigning ? "not-allowed" : "pointer",
                    }}
                  >
                    {reassigning ? "Working..." : "Release Desk"}
                  </button>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => setSelectedDesk(null)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className={styles.submitBtn}
                      onClick={handleReassign}
                      disabled={!reassignDeskId || reassigning}
                    >
                      {reassigning ? "Reassigning..." : "Reassign"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  padding: "0.85rem 1rem",
                  borderRadius: 10,
                  background: "rgba(52, 211, 153, 0.1)",
                  border: "1px solid rgba(52, 211, 153, 0.25)",
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{ color: "var(--color-success)", fontWeight: 600, fontSize: "14px" }}>
                    ✓ Available for Allocation
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
                    Capacity: <strong>{selectedDesk.capacity} members</strong>
                  </span>
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <label className={styles.formLabel} style={{ display: "block", marginBottom: 6 }}>
                    Assign an unallocated team to this desk:
                  </label>
                  <input
                    type="text"
                    placeholder="Search unseated teams..."
                    value={teamSearchQuery}
                    onChange={(e) => setTeamSearchQuery(e.target.value)}
                    className={styles.input}
                    style={{ marginBottom: 8, fontSize: "13px", padding: "8px 12px" }}
                  />

                  {loadingUnseated ? (
                    <div style={{ fontSize: "13px", color: "var(--color-ink-muted)", padding: "8px 0" }}>
                      Loading unseated teams...
                    </div>
                  ) : (
                    <select
                      className={styles.input}
                      value={selectedTeamToAssign}
                      onChange={(e) => setSelectedTeamToAssign(e.target.value)}
                    >
                      <option value="">Select team to seat at Desk D{selectedDesk.deskNumber}...</option>
                      {unseatedTeams
                        .filter((t) =>
                          !teamSearchQuery ||
                          t.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                          (t.leaderEmail && t.leaderEmail.toLowerCase().includes(teamSearchQuery.toLowerCase()))
                        )
                        .map((t) => {
                          const fits = t.memberCount <= selectedDesk.capacity;
                          return (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.memberCount} members) — {t.leaderEmail || "No email"}{" "}
                              {!fits ? `[⚠️ Exceeds cap of ${selectedDesk.capacity}]` : ""}
                            </option>
                          );
                        })}
                    </select>
                  )}

                  {unseatedTeams.length === 0 && !loadingUnseated && (
                    <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", marginTop: 6 }}>
                      No unseated teams found. All registered teams have already been assigned desks!
                    </p>
                  )}
                </div>

                {selectedTeamToAssign && (() => {
                  const chosen = unseatedTeams.find((t) => t.id === selectedTeamToAssign);
                  if (!chosen) return null;
                  const exceeds = chosen.memberCount > selectedDesk.capacity;
                  return (
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: exceeds ? "rgba(239, 68, 68, 0.1)" : "var(--color-surface-2)",
                      border: `1px solid ${exceeds ? "rgba(239, 68, 68, 0.3)" : "var(--color-hairline)"}`,
                      fontSize: "13px",
                      marginBottom: "1.25rem",
                    }}>
                      <div>Team: <strong>{chosen.name}</strong> ({chosen.memberCount} members)</div>
                      {chosen.leaderEmail && <div style={{ color: "var(--color-ink-muted)", fontSize: "12px" }}>Leader: {chosen.leaderEmail}</div>}
                      {exceeds && (
                        <div style={{ color: "var(--color-error)", fontWeight: 600, marginTop: 4 }}>
                          ⚠️ Team size ({chosen.memberCount}) exceeds desk capacity ({selectedDesk.capacity}). Allocation may result in tight seating.
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setSelectedDesk(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={handleAssignDesk}
                    disabled={!selectedTeamToAssign || assigningDesk}
                  >
                    {assigningDesk ? "Allocating..." : `Allocate to Desk D${selectedDesk.deskNumber} →`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Release Modal */}
      <ConfirmModal
        isOpen={confirmRelease}
        title="Release Assigned Desk"
        message={`Are you sure you want to release Desk D${selectedDesk?.deskNumber} from team "${selectedDesk?.team?.name}"? The team will be returned to waitlisted status.`}
        confirmText="Yes, Release Desk"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={executeRelease}
        onCancel={() => setConfirmRelease(false)}
      />
    </div>
  );
}
