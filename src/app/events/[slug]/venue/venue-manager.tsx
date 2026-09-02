"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const [rooms, setRooms] = useState(initialRooms);
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

  const refresh = useCallback(() => router.refresh(), [router]);

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
        alert(`Allocated ${data.allocated} of ${data.total} waitlisted teams`);
        refresh();
      }
    } finally {
      setAutoAllotting(false);
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
                  className={`${styles.deskCell} ${
                    desk.isAllocated ? styles.deskFilled : styles.deskAvailable
                  }`}
                  title={
                    desk.team
                      ? `${desk.team.name} (${desk.team.memberCount} members)`
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
    </div>
  );
}
