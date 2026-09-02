"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./dashboard.module.css";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isLeader: boolean;
}

interface DeskInfo {
  id: string;
  deskNumber: number;
  capacity: number;
  roomName: string;
  roomNumber: number;
}

interface TeamInfo {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  qrToken: string;
}

interface EventInfo {
  id: string;
  title: string;
  slug: string;
  status: string;
  eventStarts: Date | string | null;
  eventEnds: Date | string | null;
}

interface ParticipantDashboardProps {
  event: EventInfo;
  team: TeamInfo;
  members: TeamMember[];
  desk: DeskInfo | null;
  qrDataUrl: string;
}

interface RoundData {
  id: string;
  roundNumber: number;
  title: string;
  status: string;
  submissionDeadline: string | null;
  problemRevealAt: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  createdAt: string;
}

export default function ParticipantDashboard({
  event,
  team,
  members,
  desk,
  qrDataUrl,
}: ParticipantDashboardProps) {
  const [downloading, setDownloading] = useState(false);
  const [, setRounds] = useState<RoundData[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeRound, setActiveRound] = useState<RoundData | null>(null);

  // Problem reveal
  const [problems, setProblems] = useState<Array<{ id: string; title: string; description: string }>>([]);
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Submission
  const [githubUrl, setGithubUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subStatus, setSubStatus] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Status config
  const statusLabels: Record<string, { label: string; classColor: string }> = {
    REGISTERED: { label: "Registered", classColor: styles.statusWarning },
    WAITLISTED: { label: "Waitlisted for Desk", classColor: styles.statusWarning },
    CHECKED_IN: { label: "Checked In (Venue)", classColor: styles.statusSuccess },
    ACTIVE: { label: "Active in Hackathon", classColor: styles.statusSuccess },
    SHORTLISTED: { label: "Shortlisted for Next Round", classColor: styles.statusAccent },
    FINALIST: { label: "Finalist", classColor: styles.statusAccent },
    WINNER: { label: "🏆 Winner", classColor: styles.statusAccent },
    ELIMINATED: { label: "Round Completed", classColor: styles.statusMuted },
  };

  const currentStatus = statusLabels[team.status] || {
    label: team.status,
    classColor: styles.statusMuted,
  };

  // SSE Live Feed
  useEffect(() => {
    const es = new EventSource(`/api/events/${event.slug}/live`);
    eventSourceRef.current = es;

    es.addEventListener("init", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRounds(data.rounds || []);
        setAnnouncements(data.announcements || []);
        const active = (data.rounds || []).find(
          (r: RoundData) => r.status === "SUBMISSION_OPEN" || r.status === "JUDGING"
        );
        setActiveRound(active || null);
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener("round:status", (e) => {
      try {
        const data = JSON.parse(e.data);
        setRounds((prev) =>
          prev.map((r) => (r.id === data.roundId ? { ...r, status: data.status } : r))
        );
      } catch { /* ignore */ }
    });

    es.addEventListener("announcement", (e) => {
      try {
        const data = JSON.parse(e.data);
        setAnnouncements((prev) => [data, ...prev].slice(0, 20));
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [event.slug]);

  // Load problems for active round
  const loadProblems = useCallback(async (roundId: string) => {
    try {
      const res = await fetch(`/api/events/${event.slug}/rounds/${roundId}/problems`);
      if (res.ok) {
        const json = await res.json();
        setProblems(json.data.problems || []);
        setRevealed(json.data.revealed);
        if (!json.data.revealed && json.data.revealAt) {
          const revealTime = new Date(json.data.revealAt).getTime();
          const interval = setInterval(() => {
            const diff = revealTime - Date.now();
            if (diff <= 0) {
              clearInterval(interval);
              setCountdown(null);
              loadProblems(roundId);
            } else {
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              const s = Math.floor((diff % 60000) / 1000);
              setCountdown(`${h}h ${m}m ${s}s`);
            }
          }, 1000);
          return () => clearInterval(interval);
        }
      }
    } catch { /* ignore */ }
  }, [event.slug]);

  useEffect(() => {
    if (activeRound) {
      loadProblems(activeRound.id);
    }
  }, [activeRound, loadProblems]);

  // Check existing submission
  useEffect(() => {
    if (!activeRound) return;
    fetch(`/api/events/${event.slug}/rounds/${activeRound.id}/submissions`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.githubUrl) {
          setGithubUrl(json.data.githubUrl);
          setSubStatus("saved");
        }
        if (json.data?.isLocked) {
          setSubStatus("locked");
        }
      })
      .catch(() => {});
  }, [event.slug, activeRound]);

  async function handleSubmit() {
    if (!activeRound || !githubUrl.trim()) return;
    setSubmitting(true);
    const res = await fetch(
      `/api/events/${event.slug}/rounds/${activeRound.id}/submissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl }),
      }
    );
    setSubmitting(false);
    if (res.ok) {
      setSubStatus("saved");
    } else {
      const json = await res.json();
      alert(json.error || "Submission failed");
    }
  }

  return (
    <div className={styles.container}>
      {/* Top Banner */}
      <div className={styles.banner}>
        <div className={styles.bannerText}>
          <div className={styles.badgeRow}>
            <span className={`${styles.statusPill} ${currentStatus.classColor}`}>
              {currentStatus.label}
            </span>
            <span className={styles.eventStagePill}>
              Event Phase: {event.status.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className={styles.teamTitle}>{team.name}</h1>
          <p className={styles.eventSubtitle}>{event.title}</p>
        </div>
      </div>

      {/* Live Announcements Ticker */}
      {announcements.length > 0 && (
        <div className={styles.announceBanner}>
          <span className={styles.announceIcon}>📢</span>
          <div className={styles.announceScroll}>
            <strong>{announcements[0].title}</strong> — {announcements[0].content}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className={styles.grid}>
        {/* Left Column: QR Pass */}
        <div className={styles.qrCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardHeading}>Physical Check-in Pass</h2>
            <span className={styles.qrBadge}>Live Token</span>
          </div>

          <p className={styles.qrInstructions}>
            Present this QR code to the event coordinator at the venue entrance
            or desk scan.
          </p>

          <div className={styles.qrWrapper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR Pass for ${team.name}`}
              className={styles.qrImage}
            />
          </div>

          <div className={styles.tokenBox}>
            <span className={styles.tokenLabel}>Pass Token</span>
            <code className={styles.tokenValue}>{team.qrToken}</code>
          </div>

          <a
            href={`/api/events/${event.slug}/my-qr/download`}
            download
            className={styles.downloadBtn}
            onClick={() => setDownloading(true)}
          >
            {downloading ? "Downloading..." : "⬇ Download Offline Pass (PNG)"}
          </a>
        </div>

        {/* Right Column */}
        <div className={styles.infoColumn}>
          {/* Active Round — Problem Statements & Submission */}
          {activeRound && (
            <div className={styles.roundCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardHeading}>
                  Round {activeRound.roundNumber}: {activeRound.title}
                </h2>
                <span className={styles.roundStatusPill}>
                  {activeRound.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Problem Statements */}
              {!revealed && countdown ? (
                <div className={styles.countdownBox}>
                  <span className={styles.countdownLabel}>Problem Reveal In</span>
                  <span className={styles.countdownTimer}>{countdown}</span>
                </div>
              ) : revealed && problems.length > 0 ? (
                <div className={styles.problemList}>
                  <h3 className={styles.subHeading}>Problem Statements</h3>
                  {problems.map((p) => (
                    <div key={p.id} className={styles.problemItem}>
                      <strong>{p.title}</strong>
                      <p className={styles.problemDesc}>{p.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Submission Form */}
              {activeRound.status === "SUBMISSION_OPEN" && (
                <div className={styles.submitSection}>
                  <h3 className={styles.subHeading}>Submit Your Project</h3>
                  {activeRound.submissionDeadline && (
                    <p className={styles.deadline}>
                      ⏰ Deadline: {new Date(activeRound.submissionDeadline).toLocaleString()}
                    </p>
                  )}
                  <div className={styles.submitForm}>
                    <input
                      type="url"
                      placeholder="https://github.com/your-user/your-repo"
                      value={githubUrl}
                      onChange={(e) => { setGithubUrl(e.target.value); setSubStatus(null); }}
                      className={styles.submitInput}
                      disabled={subStatus === "locked"}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !githubUrl.trim() || subStatus === "locked"}
                      className={styles.submitBtn}
                    >
                      {submitting ? "Saving..." : subStatus === "saved" ? "✓ Saved — Update" : subStatus === "locked" ? "🔒 Locked" : "Submit"}
                    </button>
                  </div>
                  {subStatus === "saved" && (
                    <p className={styles.submitSuccess}>✅ Submission saved. You can update it until the deadline.</p>
                  )}
                  {subStatus === "locked" && (
                    <p className={styles.submitLocked}>🔒 Submission is locked and cannot be modified.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Desk Allocation Card */}
          <div className={styles.infoCard}>
            <h2 className={styles.cardHeading}>Venue & Seating</h2>
            {desk ? (
              <div className={styles.deskBox}>
                <div className={styles.deskItem}>
                  <span className={styles.deskLabel}>Assigned Room</span>
                  <span className={styles.deskValue}>
                    {desk.roomName} (Room #{desk.roomNumber})
                  </span>
                </div>
                <div className={styles.deskItem}>
                  <span className={styles.deskLabel}>Assigned Desk</span>
                  <span className={`${styles.deskValue} ${styles.deskHighlight}`}>
                    Desk #{desk.deskNumber}
                  </span>
                </div>
                <div className={styles.deskItem}>
                  <span className={styles.deskLabel}>Capacity</span>
                  <span className={styles.deskValue}>{desk.capacity} Seats</span>
                </div>
              </div>
            ) : (
              <div className={styles.waitlistBox}>
                <span className={styles.waitlistIcon}>⏳</span>
                <div>
                  <h4 className={styles.waitlistTitle}>Desk Auto-Allocation Pending</h4>
                  <p className={styles.waitlistDesc}>
                    Desks are automatically allocated as rooms become available. Your
                    registration is secured!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Team Members Card */}
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardHeading}>Team Roster ({members.length})</h2>
              <span className={styles.memberCountBadge}>
                {team.memberCount} Registered
              </span>
            </div>

            <div className={styles.memberList}>
              {members.map((member) => (
                <div key={member.id} className={styles.memberItem}>
                  <div className={styles.memberAvatar}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.memberDetails}>
                    <div className={styles.memberNameRow}>
                      <span className={styles.memberName}>{member.name}</span>
                      {member.isLeader && (
                        <span className={styles.leaderBadge}>Leader</span>
                      )}
                    </div>
                    <span className={styles.memberEmail}>{member.email}</span>
                    {member.phone && (
                      <span className={styles.memberPhone}>{member.phone}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Announcements Feed */}
          {announcements.length > 1 && (
            <div className={styles.infoCard}>
              <h2 className={styles.cardHeading}>Announcements</h2>
              <div className={styles.annFeed}>
                {announcements.slice(0, 5).map((a) => (
                  <div key={a.id} className={`${styles.annItem} ${a.priority === "URGENT" ? styles.annUrgent : ""}`}>
                    <strong>{a.title}</strong>
                    <p>{a.content}</p>
                    <span className={styles.annTime}>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase Guidance */}
          <div className={styles.guidanceCard}>
            <h3 className={styles.guidanceTitle}>Next Steps</h3>
            {team.status === "REGISTERED" || team.status === "WAITLISTED" ? (
              <p className={styles.guidanceText}>
                1. Save or screenshot your check-in QR code pass above.
                <br />
                2. Arrive at the venue and show this QR to the coordinator.
                <br />
                3. Once scanned, your attendance will be recorded and desk confirmed!
              </p>
            ) : team.status === "CHECKED_IN" || team.status === "ACTIVE" ? (
              <p className={styles.guidanceText}>
                You are checked in! Proceed to your assigned desk (Desk #{desk?.deskNumber || "TBA"}).
                When the round begins, problem statements and submission guidelines will appear here.
              </p>
            ) : (
              <p className={styles.guidanceText}>
                Stay tuned for live judging updates and announcement feeds during the round!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
