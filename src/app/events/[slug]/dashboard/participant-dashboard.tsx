"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import CertificateCanvasModal, { CertificateData } from "@/components/certificates/certificate-canvas-modal";
import { useToast } from "@/components/ui/Toast";
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
  college?: string | null;
  theme?: string | null;
  problemStatement?: string | null;
  leaderEmail?: string | null;
  leaderPhone?: string | null;
  githubUrl?: string | null;
  pptUrl?: string | null;
  demoUrl?: string | null;
  formResponses?: any;
}

interface EventInfo {
  id: string;
  title: string;
  slug: string;
  status: string;
  participantNotice?: string | null;
  eventStarts: Date | string | null;
  eventEnds: Date | string | null;
}

export interface CertificateItem {
  id: string;
  recipientName: string;
  teamName: string | null;
  type: string;
  verificationCode: string;
  generatedAt: Date | string | null;
}

interface ParticipantDashboardProps {
  event: EventInfo;
  team: TeamInfo;
  members: TeamMember[];
  desk: DeskInfo | null;
  qrDataUrl: string;
  certificates?: CertificateItem[];
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
  certificates = [],
}: ParticipantDashboardProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [activeCert, setActiveCert] = useState<CertificateData | null>(null);
  const [, setRounds] = useState<RoundData[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeRound, setActiveRound] = useState<RoundData | null>(null);

  // Problem reveal
  const [problems, setProblems] = useState<Array<{ id: string; title: string; description: string }>>([]);
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Submission state with persistence
  const [projectTitle, setProjectTitle] = useState(team.problemStatement || "");
  const [projectDescription, setProjectDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState(team.githubUrl || "");
  const [pptUrl, setPptUrl] = useState(team.pptUrl || "");
  const [demoUrl, setDemoUrl] = useState(team.demoUrl || "");
  const [submitting, setSubmitting] = useState(false);
  const [subStatus, setSubStatus] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  function copyToken() {
    navigator.clipboard.writeText(team.qrToken);
    setCopiedToken(true);
    toast.info("Offline pass token copied to clipboard!");
    setTimeout(() => setCopiedToken(false), 2500);
  }

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

  // Check existing submission and load all persistent fields
  useEffect(() => {
    if (!activeRound) return;
    fetch(`/api/events/${event.slug}/rounds/${activeRound.id}/submissions`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          if (json.data.projectTitle) setProjectTitle(json.data.projectTitle);
          if (json.data.projectDescription) setProjectDescription(json.data.projectDescription);
          if (json.data.githubUrl) setGithubUrl(json.data.githubUrl);
          if (json.data.pptUrl) setPptUrl(json.data.pptUrl);
          if (json.data.demoUrl) setDemoUrl(json.data.demoUrl);
          setSubStatus("saved");
        }
        if (json.data?.isLocked) {
          setSubStatus("locked");
        }
      })
      .catch(() => {});
  }, [event.slug, activeRound]);

  async function handleSubmit() {
    if (!activeRound) return;
    if (!projectTitle.trim() && !githubUrl.trim()) {
      toast.error("Please provide at least a project title or repository URL");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/events/${event.slug}/rounds/${activeRound.id}/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectTitle: projectTitle.trim() || undefined,
            projectDescription: projectDescription.trim() || undefined,
            githubUrl: githubUrl.trim() || undefined,
            pptUrl: pptUrl.trim() || undefined,
            demoUrl: demoUrl.trim() || undefined,
          }),
        }
      );
      setSubmitting(false);
      if (res.ok) {
        setSubStatus("saved");
        toast.success("Project submission saved successfully!");
      } else {
        const json = await res.json();
        toast.error(json.error || "Submission failed");
      }
    } catch {
      setSubmitting(false);
      toast.error("Network error while submitting. Please try again.");
    }
  }

  const formResponses = team.formResponses || {};
  const formMembers: any[] = Array.isArray(formResponses.members) ? formResponses.members : [];
  const leaderData = formResponses.leader || {};

  const utrNumber = formResponses.utr || formResponses.utrNumber;
  const paymentReceiptUrl = formResponses.paymentScreenshot || formResponses.paymentReceiptUrl;
  const chosenTheme = team.theme || formResponses.chosenTheme || formResponses.theme;
  const leaderCollege = team.college || leaderData.college || formResponses.leaderCollege;
  const leaderDepartment = leaderData.departmentYear || formResponses.leaderDepartment;
  const leaderPortfolio = leaderData.portfolio || formResponses.leaderPortfolio;
  const leaderPhone = team.leaderPhone || leaderData.phone || formResponses.leaderPhone;

  const enrichedMembers = members.map((member, idx) => {
    const matched = formMembers.find(
      (fm) => fm.email && member.email && fm.email.trim().toLowerCase() === member.email.trim().toLowerCase()
    ) || (member.isLeader ? formMembers[0] : formMembers[idx]);

    const role = matched?.role || (member.isLeader ? "Team Leader" : "Team Member");
    const college = matched?.college || (member.isLeader ? leaderCollege : team.college);
    const portfolioUrl = matched?.portfolio || matched?.portfolioUrl || (member.isLeader ? leaderPortfolio : null);
    const phone = member.phone || matched?.phone || (member.isLeader ? leaderPhone : null);
    const department = member.isLeader ? leaderDepartment : null;

    return {
      ...member,
      role,
      college,
      portfolioUrl,
      phone,
      department,
    };
  });

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

      {/* Organizer Notice Banner if present */}
      {event.participantNotice && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.12))",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "var(--rounded-lg)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: "22px" }}>📌</span>
          <div>
            <strong style={{ fontSize: "13px", color: "var(--color-ink)", display: "block" }}>
              Official Announcement from Organizers
            </strong>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: "2px 0 0", whiteSpace: "pre-line" }}>
              {event.participantNotice}
            </p>
          </div>
        </div>
      )}

      {/* Desk Seating Banner if Allocated */}
      {desk && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "var(--rounded-lg)",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>📍</span>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>
                Assigned Venue Workspace
              </span>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--color-ink)" }}>
                {desk.roomName} (Room #{desk.roomNumber}) — Desk #{desk.deskNumber}
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#10b981",
              background: "rgba(16, 185, 129, 0.15)",
              padding: "4px 12px",
              borderRadius: "99px",
            }}
          >
            Capacity: {desk.capacity} Seats Allocated
          </span>
        </div>
      )}

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", marginTop: "4px" }}>
              <code className={styles.tokenValue} style={{ margin: 0 }}>{team.qrToken}</code>
              <button
                type="button"
                onClick={copyToken}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "var(--color-ink)",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {copiedToken ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
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
                  <h3 className={styles.subHeading}>Submit Project Details & Idea</h3>
                  {activeRound.submissionDeadline && (
                    <p className={styles.deadline}>
                      ⏰ Deadline: {new Date(activeRound.submissionDeadline).toLocaleString()}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: "4px" }}>
                        PROJECT TITLE / PRODUCT NAME
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MedAI: Autonomous Disease Screener"
                        value={projectTitle}
                        onChange={(e) => { setProjectTitle(e.target.value); setSubStatus(null); }}
                        className={styles.submitInput}
                        disabled={subStatus === "locked"}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: "4px" }}>
                        PROBLEM STATEMENT / VALUE PROPOSITION
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Brief summary of what you are solving and key technical highlights..."
                        value={projectDescription}
                        onChange={(e) => { setProjectDescription(e.target.value); setSubStatus(null); }}
                        className={styles.submitInput}
                        disabled={subStatus === "locked"}
                        style={{ width: "100%", resize: "vertical" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: "4px" }}>
                          GITHUB REPOSITORY URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://github.com/your-org/your-repo"
                          value={githubUrl}
                          onChange={(e) => { setGithubUrl(e.target.value); setSubStatus(null); }}
                          className={styles.submitInput}
                          disabled={subStatus === "locked"}
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: "4px" }}>
                          PITCH DECK / SLIDES URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://docs.google.com/presentation/d/... or Canva"
                          value={pptUrl}
                          onChange={(e) => { setPptUrl(e.target.value); setSubStatus(null); }}
                          className={styles.submitInput}
                          disabled={subStatus === "locked"}
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: "4px" }}>
                        LIVE DEMO / VIDEO LINK (OPTIONAL)
                      </label>
                      <input
                        type="url"
                        placeholder="https://your-project.vercel.app or YouTube"
                        value={demoUrl}
                        onChange={(e) => { setDemoUrl(e.target.value); setSubStatus(null); }}
                        className={styles.submitInput}
                        disabled={subStatus === "locked"}
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || (!projectTitle.trim() && !githubUrl.trim()) || subStatus === "locked"}
                        className={styles.submitBtn}
                      >
                        {submitting ? "Saving..." : subStatus === "saved" ? "✓ Saved — Update Submission" : subStatus === "locked" ? "🔒 Submission Locked" : "Save Project Submission"}
                      </button>
                    </div>
                  </div>
                  {subStatus === "saved" && (
                    <p className={styles.submitSuccess} style={{ marginTop: "8px" }}>
                      ✅ Submission saved to database. Your idea and links persist across reloads and will be reviewed by judges.
                    </p>
                  )}
                  {subStatus === "locked" && (
                    <p className={styles.submitLocked} style={{ marginTop: "8px" }}>
                      🔒 Submissions for this round are locked.
                    </p>
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
                <span className={styles.waitlistIcon}>📍</span>
                <div>
                  <h4 className={styles.waitlistTitle}>On-Site Check-in Required</h4>
                  <p className={styles.waitlistDesc}>
                    Desks are assigned upon physical check-in at the venue. Please present your Team QR pass
                    to the event coordinator at the registration desk to record attendance and receive your workspace!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Team Members Card */}
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardHeading}>Team Roster ({enrichedMembers.length})</h2>
              <span className={styles.memberCountBadge}>
                {team.memberCount} Registered
              </span>
            </div>

            <div className={styles.memberList}>
              {enrichedMembers.map((member) => (
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
                      {member.role && (
                        <span className={styles.memberRoleBadge}>{member.role}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                      <a href={`mailto:${member.email}`} className={styles.memberEmail} style={{ textDecoration: "none" }}>
                        ✉️ {member.email}
                      </a>
                      {member.phone && (
                        <a href={`tel:${member.phone}`} className={styles.memberPhone} style={{ textDecoration: "none" }}>
                          📞 {member.phone}
                        </a>
                      )}
                    </div>
                    {(member.college || member.department || member.portfolioUrl) && (
                      <div className={styles.memberMetaRow}>
                        {member.college && (
                          <span className={styles.memberCollegeTag}>🎓 {member.college}</span>
                        )}
                        {member.department && (
                          <span className={styles.memberCollegeTag}>🏛️ {member.department}</span>
                        )}
                        {member.portfolioUrl && (
                          <a
                            href={member.portfolioUrl.startsWith("http") ? member.portfolioUrl : `https://${member.portfolioUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.memberLinkBadge}
                          >
                            🔗 Portfolio / GitHub ↗
                          </a>
                        )}
                      </div>
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

          {/* Results Card — shown when results are published */}
          {["SHORTLISTED", "FINALIST", "WINNER", "ELIMINATED"].includes(team.status) && (
            <div className={styles.infoCard}>
              <h2 className={styles.cardHeading}>🏆 Your Results</h2>
              <div style={{
                padding: "1rem",
                background: team.status === "WINNER"
                  ? "rgba(251,191,36,0.08)"
                  : team.status === "FINALIST" || team.status === "SHORTLISTED"
                  ? "rgba(168,85,247,0.08)"
                  : "rgba(255,255,255,0.03)",
                borderRadius: 10,
                textAlign: "center",
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                  {team.status === "WINNER" ? "🏆" : team.status === "FINALIST" ? "🥈" : team.status === "SHORTLISTED" ? "⭐" : "👏"}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e0e0ff" }}>
                  {team.status === "WINNER" && "Congratulations! You are a Winner! 🎉"}
                  {team.status === "FINALIST" && "You are a Finalist!"}
                  {team.status === "SHORTLISTED" && "You have been shortlisted for the next round!"}
                  {team.status === "ELIMINATED" && "Thank you for participating!"}
                </div>
                <a
                  href={`/events/${event.slug}/results`}
                  style={{
                    display: "inline-block",
                    marginTop: "0.75rem",
                    color: "#a5b4fc",
                    fontSize: "0.85rem",
                    textDecoration: "underline",
                  }}
                >
                  View Full Rankings →
                </a>
              </div>
            </div>
          )}

          {/* Certificates Card */}
          {certificates && certificates.length > 0 && (
            <div className={styles.infoCard}>
              <h2 className={styles.cardHeading}>🎓 Official Certificates</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", margin: "0 0 1rem" }}>
                Your team has verified certificates available for preview and download.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.8rem 1rem",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.9rem" }}>
                        {cert.recipientName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                        {cert.type.replace(/_/g, " ")} · Code:{" "}
                        <span style={{ fontFamily: "monospace", color: "#a5b4fc" }}>
                          {cert.verificationCode}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setActiveCert({
                          id: cert.id,
                          recipientName: cert.recipientName,
                          teamName: cert.teamName || team.name,
                          eventName: event.title,
                          type: cert.type,
                          verificationCode: cert.verificationCode,
                          generatedAt: cert.generatedAt,
                          eventSlug: event.slug,
                        })
                      }
                      style={{
                        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        color: "white",
                        border: "none",
                        padding: "0.45rem 0.9rem",
                        borderRadius: 8,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🎓 View & Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registration & Payment Verification Details */}
          {(chosenTheme || leaderCollege || leaderDepartment || utrNumber || paymentReceiptUrl) && (
            <div className={styles.infoCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardHeading}>Registration & Verification</h2>
                {utrNumber && (
                  <span className={styles.leaderBadge}>✓ Payment Verified</span>
                )}
              </div>
              <div className={styles.deskBox}>
                {chosenTheme && (
                  <div className={styles.deskItem}>
                    <span className={styles.deskLabel}>Chosen Theme / Track</span>
                    <span className={styles.deskValue}>{chosenTheme}</span>
                  </div>
                )}
                {leaderCollege && (
                  <div className={styles.deskItem}>
                    <span className={styles.deskLabel}>College / University</span>
                    <span className={styles.deskValue}>{leaderCollege}</span>
                  </div>
                )}
                {leaderDepartment && (
                  <div className={styles.deskItem}>
                    <span className={styles.deskLabel}>Department & Year</span>
                    <span className={styles.deskValue}>{leaderDepartment}</span>
                  </div>
                )}
              </div>

              {(utrNumber || paymentReceiptUrl) && (
                <div className={styles.verificationRow}>
                  {utrNumber && (
                    <div className={styles.verificationItem}>
                      <span className={styles.verificationLabel}>Transaction / UTR ID</span>
                      <span className={styles.verificationValue}>{utrNumber}</span>
                    </div>
                  )}
                  {paymentReceiptUrl && (
                    <a
                      href={paymentReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.receiptLink}
                    >
                      🧾 View Payment Receipt ↗
                    </a>
                  )}
                </div>
              )}
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
            ) : team.status === "WINNER" || team.status === "FINALIST" ? (
              <p className={styles.guidanceText}>
                🎉 Congratulations on your achievement! Check back here for your certificate download when it becomes available.
              </p>
            ) : (
              <p className={styles.guidanceText}>
                Stay tuned for live judging updates and announcement feeds during the round!
              </p>
            )}
          </div>
        </div>
      </div>

      {activeCert && (
        <CertificateCanvasModal
          certificate={activeCert}
          onClose={() => setActiveCert(null)}
          eventSlug={event.slug}
        />
      )}
    </div>
  );
}
