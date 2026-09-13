"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./coordinator.module.css";

interface DeskSummary {
  deskNumber: number;
  roomName: string;
}

interface RosterItem {
  teamId: string;
  teamName: string;
  memberCount: number;
  status: string;
  isCheckedIn: boolean;
  attendanceRecordId: string | null;
  checkedInAt: Date | string | null;
  checkInMethod: string | null;
  desk: DeskSummary | null;
}

interface AttendanceStats {
  total: number;
  checkedIn: number;
  pending: number;
  rate: number;
}

interface EventSummary {
  id: string;
  title: string;
  slug: string;
}

interface CoordinatorScannerProps {
  event: EventSummary;
  initialRoster: RosterItem[];
  initialStats: AttendanceStats;
}

export default function CoordinatorScanner({
  event,
  initialRoster,
  initialStats,
}: CoordinatorScannerProps) {
  const [activeTab, setActiveTab] = useState<"scan" | "roster">("scan");
  const [roster, setRoster] = useState<RosterItem[]>(initialRoster);
  const [stats, setStats] = useState<AttendanceStats>(initialStats);
  const [search, setSearch] = useState("");

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: "success" | "warning" | "error";
    message: string;
    teamName?: string;
    deskNumber?: number;
    roomName?: string;
  } | null>(null);

  const [processingManualId, setProcessingManualId] = useState<string | null>(null);
  const [personalScans, setPersonalScans] = useState(0);
  const scannerRef = useRef<unknown>(null);
  const isScanningRef = useRef(false);

  // Send periodic presence heartbeat
  useEffect(() => {
    fetch(`/api/events/${event.slug}/staff/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scanner_opened" }),
    }).catch(() => {});

    const interval = setInterval(() => {
      fetch(`/api/events/${event.slug}/staff/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping" }),
      }).catch(() => {});
    }, 45000);

    return () => clearInterval(interval);
  }, [event.slug]);

  // Refresh roster
  const refreshRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${event.slug}/attendance`);
      if (res.ok) {
        const json = await res.json();
        setRoster(json.data.roster);
        setStats(json.data.stats);
      }
    } catch {
      console.error("Failed to refresh roster");
    }
  }, [event.slug]);

  // Handle scanned payload
  const handleScannedPayload = useCallback(
    async (payloadText: string) => {
      if (isScanningRef.current) return;
      isScanningRef.current = true;

      try {
        const res = await fetch(`/api/events/${event.slug}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: payloadText }),
        });

        const json = await res.json();

        if (res.ok) {
          const team = json.data?.team;
          const desk = json.data?.desk;
          const already = json.data?.alreadyCheckedIn;

          if (!already) {
            setPersonalScans((prev) => prev + 1);
            fetch(`/api/events/${event.slug}/staff/heartbeat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "qr_scan" }),
            }).catch(() => {});
          }

          setScanResult({
            status: already ? "warning" : "success",
            message: already ? "Already checked in" : "Check-in verified!",
            teamName: team?.name,
            deskNumber: desk?.deskNumber,
            roomName: desk?.roomName,
          });
          await refreshRoster();
        } else {
          setScanResult({
            status: "error",
            message: json.error || "Invalid QR Code",
          });
        }
      } catch (err: unknown) {
        const e = err as Error;
        setScanResult({
          status: "error",
          message: e.message || "Network error during scan",
        });
      } finally {
        setTimeout(() => {
          isScanningRef.current = false;
        }, 2000);
      }
    },
    [event.slug, refreshRoster]
  );

  // Start / Stop html5-qrcode camera
  useEffect(() => {
    let html5QrCode: any = null;

    if (activeTab === "scan" && scanning) {
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        const element = document.getElementById("qr-reader");
        if (!element) return;

        html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        html5QrCode
          .start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText: string) => {
              handleScannedPayload(decodedText);
            },
            () => {
              // ignore frame read failures
            }
          )
          .catch((err: any) => {
            console.error("Unable to start camera", err);
            setScanning(false);
            setScanResult({
              status: "error",
              message: "Camera access denied or not available. Use manual check-in.",
            });
          });
      });
    }

    return () => {
      if (html5QrCode) {
        try {
          html5QrCode.stop().then(() => html5QrCode.clear());
        } catch {
          // cleanup
        }
      }
    };
  }, [activeTab, scanning, handleScannedPayload]);

  // Manual Check-in toggle
  async function handleManualCheckIn(item: RosterItem) {
    setProcessingManualId(item.teamId);
    try {
      if (!item.isCheckedIn) {
        const res = await fetch(`/api/events/${event.slug}/attendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: item.teamId }),
        });
        if (res.ok) {
          await refreshRoster();
        }
      } else if (item.attendanceRecordId) {
        const res = await fetch(
          `/api/events/${event.slug}/attendance/${item.attendanceRecordId}/undo`,
          { method: "POST" }
        );
        if (res.ok) {
          await refreshRoster();
        }
      }
    } finally {
      setProcessingManualId(null);
    }
  }

  const filteredRoster = roster.filter(
    (t) =>
      t.teamName.toLowerCase().includes(search.toLowerCase()) ||
      (t.desk && `D${t.desk.deskNumber}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Coordinator Scanner</h1>
          <p className={styles.subtitle}>{event.title}</p>
        </div>
        <a
          href={`/api/events/${event.slug}/attendance/export`}
          download
          className={styles.exportBtn}
        >
          ⬇ Export Attendance (CSV)
        </a>
      </div>

      {/* Realtime Attendance Progress Bar */}
      <div className={styles.statsCard}>
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{stats.total}</span>
            <span className={styles.statLabel}>Registered</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.valGreen}`}>
              {stats.checkedIn}
            </span>
            <span className={styles.statLabel}>Checked In</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.valYellow}`}>
              {stats.pending}
            </span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{stats.rate.toFixed(0)}%</span>
            <span className={styles.statLabel}>Check-in Rate</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.valGreen}`}>{personalScans}</span>
            <span className={styles.statLabel}>My Scans</span>
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${stats.rate}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === "scan" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("scan")}
        >
          📷 Live Camera Scanner
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "roster" ? styles.tabActive : ""}`}
          onClick={() => {
            setActiveTab("roster");
            setScanning(false);
          }}
        >
          📋 Team Roster & Check-in ({filteredRoster.length})
        </button>
      </div>

      {/* Scanner View */}
      {activeTab === "scan" && (
        <div className={styles.scannerWrapper}>
          <div className={styles.scannerCard}>
            <div className={styles.scannerControls}>
              {!scanning ? (
                <button
                  onClick={() => {
                    setScanResult(null);
                    setScanning(true);
                  }}
                  className={styles.startScanBtn}
                >
                  Start Camera Scan
                </button>
              ) : (
                <button
                  onClick={() => setScanning(false)}
                  className={styles.stopScanBtn}
                >
                  Stop Camera
                </button>
              )}
            </div>

            <div id="qr-reader" className={styles.cameraBox}>
              {!scanning && (
                <div className={styles.cameraPlaceholder}>
                  <span className={styles.cameraIcon}>📷</span>
                  <p>Tap Start Camera Scan to begin scanning participant passes</p>
                </div>
              )}
            </div>

            {/* Scan Feedback Banner */}
            {scanResult && (
              <div
                className={`${styles.feedbackCard} ${
                  scanResult.status === "success"
                    ? styles.feedbackSuccess
                    : styles.feedbackError
                }`}
              >
                <div className={styles.feedbackIcon}>
                  {scanResult.status === "success" ? "✅" : "⚠️"}
                </div>
                <div className={styles.feedbackBody}>
                  <h4 className={styles.feedbackTitle}>{scanResult.message}</h4>
                  {scanResult.teamName && (
                    <p className={styles.feedbackTeam}>
                      Team: <strong>{scanResult.teamName}</strong>
                    </p>
                  )}
                  {scanResult.deskNumber && (
                    <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--color-accent, #6366f1)", fontWeight: 700 }}>
                      📍 Workspace: Desk #{scanResult.deskNumber} {scanResult.roomName ? `(${scanResult.roomName})` : ""}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roster View */}
      {activeTab === "roster" && (
        <div className={styles.rosterWrapper}>
          <div className={styles.rosterToolbar}>
            <input
              type="text"
              placeholder="Search by team name or desk..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.rosterList}>
            {filteredRoster.map((item) => (
              <div key={item.teamId} className={styles.rosterRow}>
                <div className={styles.rosterTeamInfo}>
                  <div className={styles.teamNameTitle}>
                    <span className={styles.rName}>{item.teamName}</span>
                    <span className={styles.rMembers}>
                      ({item.memberCount} members)
                    </span>
                  </div>
                  <div className={styles.rMetaRow}>
                    {item.desk ? (
                      <span className={styles.rDeskBadge}>
                        {item.desk.roomName} · Desk D{item.desk.deskNumber}
                      </span>
                    ) : (
                      <span className={styles.rWaitlistBadge}>Desk Pending</span>
                    )}
                    {item.isCheckedIn && item.checkedInAt && (
                      <span className={styles.rTimeBadge}>
                        Checked in{" "}
                        {new Date(item.checkedInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.rosterActions}>
                  <button
                    onClick={() => handleManualCheckIn(item)}
                    disabled={processingManualId === item.teamId}
                    className={`${styles.checkInBtn} ${
                      item.isCheckedIn
                        ? styles.checkInBtnDone
                        : styles.checkInBtnPending
                    }`}
                  >
                    {processingManualId === item.teamId
                      ? "Updating..."
                      : item.isCheckedIn
                      ? "✓ Checked In (Undo)"
                      : "Check In"}
                  </button>
                </div>
              </div>
            ))}

            {filteredRoster.length === 0 && (
              <div className={styles.emptyRoster}>
                <p>No teams matching &quot;{search}&quot;</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
