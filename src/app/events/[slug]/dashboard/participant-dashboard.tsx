"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import CertificateCanvasModal, { CertificateData } from "@/components/certificates/certificate-canvas-modal";
import { useToast } from "@/components/ui/Toast";
import styles from "./dashboard.module.css";
import type { ParticipantExperienceConfig } from "@/lib/types/participant-experience";

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
  projectName?: string | null;
  projectDescription?: string | null;
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
  participantExperienceConfig?: ParticipantExperienceConfig | any;
}

export interface CertificateItem {
  id: string;
  recipientName: string;
  teamName: string | null;
  type: string;
  verificationCode: string;
  generatedAt: Date | string | null;
}

interface HelpRequestItem {
  id: string;
  category: string;
  priority: string;
  description: string;
  location: string | null;
  status: string;
  assignedStaffId: string | null;
  resolutionNotes: string | null;
  createdAt: Date | string | null;
  assignedStaff?: { id: string; name: string | null; email: string } | null;
}

interface ParticipantDashboardProps {
  event: EventInfo;
  team: TeamInfo;
  members: TeamMember[];
  desk: DeskInfo | null;
  qrDataUrl: string;
  certificates?: CertificateItem[];
  initialHelpRequests?: HelpRequestItem[];
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

type TabKey =
  | "home"
  | "team"
  | "project"
  | "pass"
  | "support"
  | "schedule"
  | "problems"
  | "announcements"
  | "results";

const CATEGORIES = [
  { value: "TECHNICAL_ISSUE", label: "💻 Technical / Wi-Fi Issue" },
  { value: "VENUE_ISSUE", label: "🔌 Venue & Power Issue" },
  { value: "REGISTRATION_ISSUE", label: "📋 Registration / Auth Issue" },
  { value: "TEAM_ISSUE", label: "👥 Team & Member Issue" },
  { value: "FOOD_FACILITIES", label: "🍕 Food & Facilities" },
  { value: "MENTOR_STAFF", label: "🙋 Mentor / Staff Assistance" },
  { value: "JUDGE_RELATED", label: "⚖️ Judge-related Assistance" },
  { value: "SUBMISSION_ISSUE", label: "📤 Project Submission Issue" },
  { value: "OTHER", label: "❓ Other Inquiries" },
];

export default function ParticipantDashboard({
  event,
  team,
  members,
  desk,
  qrDataUrl,
  certificates = [],
  initialHelpRequests = [],
}: ParticipantDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [downloading, setDownloading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [activeCert, setActiveCert] = useState<CertificateData | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeRound, setActiveRound] = useState<RoundData | null>(null);

  // Problem reveal state
  const [problems, setProblems] = useState<Array<{ id: string; title: string; description: string }>>([]);
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Submission / Project deliverables state
  const [projectTitle, setProjectTitle] = useState(team.projectName || team.problemStatement || "");
  const [projectDescription, setProjectDescription] = useState(team.projectDescription || "");
  const [githubUrl, setGithubUrl] = useState(team.githubUrl || "");
  const [pptUrl, setPptUrl] = useState(team.pptUrl || "");
  const [demoUrl, setDemoUrl] = useState(team.demoUrl || "");
  const [submitting, setSubmitting] = useState(false);
  const [submissionSaved, setSubmissionSaved] = useState(false);

  // Help & Support state
  const [helpRequests, setHelpRequests] = useState<HelpRequestItem[]>(initialHelpRequests);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpCategory, setHelpCategory] = useState("TECHNICAL_ISSUE");
  const [helpDescription, setHelpDescription] = useState("");
  const [submittingHelp, setSubmittingHelp] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const expConfig: ParticipantExperienceConfig = event.participantExperienceConfig || {};

  function copyToken() {
    navigator.clipboard.writeText(team.qrToken);
    setCopiedToken(true);
    toast.info("Offline pass token copied to clipboard!");
    setTimeout(() => setCopiedToken(false), 2500);
  }

  // Download high-resolution offline QR card image
  function downloadQR() {
    setDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 750;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark background
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, 600, 750);

      // Accent border
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 560, 710);

      // Event Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(event.title, 300, 75);

      // Badge
      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("OFFLINE UNIVERSAL ACCESS PASS", 300, 110);

      // Team Name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(team.name, 300, 160);

      // Room & Desk
      if (desk) {
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(`${desk.roomName} | Desk #${desk.deskNumber}`, 300, 200);
      }

      // Draw QR Code
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(150, 230, 300, 300);
        ctx.drawImage(img, 160, 240, 280, 280);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px monospace";
        ctx.fillText(`Pass ID: ${team.qrToken.slice(0, 16)}...`, 300, 570);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px sans-serif";
        ctx.fillText("Valid for Entry Gate Check-in & Judge Evaluation", 300, 610);
        ctx.fillText("HackFlow — Unified Hackathon OS", 300, 650);

        const a = document.createElement("a");
        a.download = `${team.name.replace(/\s+/g, "_")}_Pass.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
        setDownloading(false);
        toast.success("Offline pass saved to your downloads!");
      };
      img.src = qrDataUrl;
    } catch {
      setDownloading(false);
      toast.error("Failed to download QR pass");
    }
  }

  // Live SSE Feed
  useEffect(() => {
    const sse = new EventSource(`/api/events/${event.slug}/live`);
    eventSourceRef.current = sse;

    sse.addEventListener("round_change", (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveRound(data.activeRound);
        toast.info(`Round update: ${data.activeRound?.title || "Status changed"}`);
      } catch {
        // ignore
      }
    });

    sse.addEventListener("announcement", (e) => {
      try {
        const data = JSON.parse(e.data);
        setAnnouncements((prev) => [data, ...prev]);
        toast.info(`📢 Announcement: ${data.title}`);
      } catch {
        // ignore
      }
    });

    return () => sse.close();
  }, [event.slug, toast]);

  // Fetch rounds and initial announcements
  useEffect(() => {
    fetch(`/api/events/${event.slug}/rounds`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setRounds(json.data);
          const active = json.data.find((r: RoundData) => r.status === "ACTIVE");
          if (active) setActiveRound(active);
        }
      });

    fetch(`/api/events/${event.slug}/announcements`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setAnnouncements(json.data);
      });
  }, [event.slug]);

  // Fetch problems for active round
  const activeRoundId = activeRound?.id;
  useEffect(() => {
    if (!activeRoundId) return;

    fetch(`/api/events/${event.slug}/rounds/${activeRoundId}/problems`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setProblems(json.data.problems || []);
          setRevealed(json.data.revealed ?? false);
        }
      });
  }, [event.slug, activeRoundId]);

  // Countdown timer for problem statement reveal
  useEffect(() => {
    if (revealed || !activeRound?.problemRevealAt) {
      setCountdown(null);
      return;
    }

    const revealTime = new Date(activeRound.problemRevealAt).getTime();
    function updateCountdown() {
      const diff = revealTime - Date.now();
      if (diff <= 0) {
        setRevealed(true);
        setCountdown(null);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h > 0 ? `${h}h ` : ""}${m}m ${s}s`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [revealed, activeRound?.problemRevealAt]);

  // Save Project Deliverables
  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = activeRound
        ? `/api/events/${event.slug}/rounds/${activeRound.id}/submissions`
        : `/api/events/${event.slug}/teams`;

      const res = await fetch(endpoint, {
        method: activeRound ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activeRound
            ? {
                projectTitle,
                projectDescription,
                githubUrl,
                pptUrl,
                demoUrl,
              }
            : {
                teamIds: [team.id],
                updates: {
                  projectName: projectTitle,
                  projectDescription,
                  githubUrl,
                  pptUrl,
                  demoUrl,
                },
              }
        ),
      });

      if (res.ok) {
        setSubmissionSaved(true);
        toast.success("Project deliverables saved successfully!");
        setTimeout(() => setSubmissionSaved(false), 4000);
      } else {
        toast.error("Failed to save project details");
      }
    } catch {
      toast.error("Network error while saving project");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Help Request
  async function handleSubmitHelp(e: React.FormEvent) {
    e.preventDefault();
    if (!helpDescription.trim() || submittingHelp) return;

    setSubmittingHelp(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/help-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: helpCategory,
          description: helpDescription.trim(),
          priority: "NORMAL",
          location: desk ? `Room ${desk.roomNumber} | Desk ${desk.deskNumber}` : undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setHelpRequests((prev) => [json.data, ...prev]);
        }
        setShowHelpModal(false);
        setHelpDescription("");
        setActiveTab("support");
        toast.success("Help request dispatched! A volunteer has been notified.");
      } else {
        toast.error("Failed to submit request");
      }
    } catch {
      toast.error("Network error submitting request");
    } finally {
      setSubmittingHelp(false);
    }
  }

  // Status mapping
  const statusLabels: Record<string, { label: string; classColor: string }> = {
    REGISTERED: { label: "Registered", classColor: styles.statusWarning },
    WAITLISTED: { label: "Waitlisted", classColor: styles.statusWarning },
    CHECKED_IN: { label: "Checked In", classColor: styles.statusSuccess },
    ACTIVE: { label: "Active", classColor: styles.statusSuccess },
    SHORTLISTED: { label: "Shortlisted", classColor: styles.statusAccent },
    FINALIST: { label: "Finalist", classColor: styles.statusAccent },
    WINNER: { label: "🏆 Winner", classColor: styles.statusAccent },
    ELIMINATED: { label: "Completed", classColor: styles.statusMuted },
  };

  const currentStatus = statusLabels[team.status] || {
    label: team.status,
    classColor: styles.statusMuted,
  };

  return (
    <div className={styles.container}>
      {/* 1. APP HEADER */}
      <header className={styles.appHeader}>
        <div className={styles.appBrand}>
          <span className={styles.appLogoPill}>HACKFLOW</span>
          <span className={styles.appEventName}>{event.title}</span>
        </div>

        <div className={styles.appHeaderActions}>
          {desk ? (
            <button
              type="button"
              className={styles.deskQuickPill}
              onClick={() => setActiveTab("pass")}
              title="Click to view QR Pass & Desk Details"
            >
              <span>📍 Room {desk.roomNumber} · Desk #{desk.deskNumber}</span>
            </button>
          ) : (
            <span className={styles.noDeskBadge}>
              Pending Desk Allotment
            </span>
          )}

          <button
            type="button"
            className={styles.supportButton}
            onClick={() => setShowHelpModal(true)}
          >
            🆘 Request Help
          </button>
        </div>
      </header>

      {/* 2. MODERN CLEAN NAVIGATION TABS */}
      <nav className={styles.navBar}>
        <button
          type="button"
          className={`${styles.navTab} ${activeTab === "home" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("home")}
        >
          <span>🏠 Dashboard</span>
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeTab === "team" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("team")}
        >
          <span>👥 My Team</span>
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeTab === "project" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("project")}
        >
          <span>🚀 Deliverables & Submission</span>
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeTab === "pass" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("pass")}
        >
          <span>🎫 Universal QR Pass</span>
        </button>
        <button
          type="button"
          className={`${styles.navTab} ${activeTab === "support" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("support")}
        >
          <span>🆘 Help Desk</span>
          {helpRequests.length > 0 && (
            <span className={styles.navBadge}>{helpRequests.length}</span>
          )}
        </button>
      </nav>

      {/* ============================================================
          TAB 1: HOME (COMPANION DASHBOARD SUMMARY)
          ============================================================ */}
      {activeTab === "home" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          {/* Hero Branding Banner */}
          <div className={styles.banner}>
            <div className={styles.bannerText}>
              <div className={styles.badgeRow}>
                <span className={`${styles.statusPill} ${currentStatus.classColor}`}>
                  {currentStatus.label}
                </span>
                {activeRound && (
                  <span className={styles.eventStagePill}>
                    ● Round {activeRound.roundNumber}: {activeRound.title}
                  </span>
                )}
              </div>
              <h1 className={styles.teamTitle}>{team.name}</h1>
              <p className={styles.eventSubtitle}>
                {expConfig.heroTagline || `Physical Hackathon Companion · ${members.length} Members`}
              </p>
            </div>

            <button
              onClick={() => setActiveTab("pass")}
              className={styles.passCardBtn}
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--rounded-pill)",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              🎫 Open QR Pass
            </button>
          </div>

          {/* Urgent Announcement Alert if any */}
          {announcements.length > 0 && (
            <div
              className={styles.announcementAlert}
              onClick={() => setActiveTab("announcements")}
              style={{ cursor: "pointer" }}
            >
              <span className={styles.announcementIcon}>📢</span>
              <div className={styles.announcementBody}>
                <strong>{announcements[0].title}</strong>
                <p>{announcements[0].content}</p>
              </div>
              <span style={{ fontSize: "11px", color: "var(--color-accent)", fontWeight: 700 }}>
                View All →
              </span>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className={styles.quickGrid}>
            {/* Desk Allocation Card */}
            <div
              className={styles.metricCard}
              onClick={() => setActiveTab("pass")}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricIcon}>📍</span>
                <span className={styles.metricBadge}>Allocated Desk</span>
              </div>
              {desk ? (
                <>
                  <div className={styles.deskBig}>
                    ROOM {desk.roomNumber} · DESK {desk.deskNumber}
                  </div>
                  <div className={styles.deskSub}>{desk.roomName}</div>
                </>
              ) : (
                <div className={styles.deskSub} style={{ marginTop: "8px" }}>
                  Pending desk allocation by staff
                </div>
              )}
            </div>

            {/* Active Round & Submission */}
            <div
              className={styles.metricCard}
              onClick={() => setActiveTab("project")}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricIcon}>🚀</span>
                <span className={styles.metricBadge}>Project Deliverables</span>
              </div>
              <div className={styles.metricValue}>
                {githubUrl ? "✓ GitHub Linked" : "⚠️ Needs Repo URL"}
              </div>
              <div className={styles.deskSub}>
                {demoUrl ? "Live Demo URL provided" : "Tap to add demo & slides"}
              </div>
            </div>

            {/* Support Ticket Quick Card */}
            <div
              className={styles.metricCard}
              onClick={() => setActiveTab("support")}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.metricHeader}>
                <span className={styles.metricIcon}>🆘</span>
                <span className={styles.metricBadge}>Help & Mentorship</span>
              </div>
              <div className={styles.metricValue}>
                {helpRequests.length > 0
                  ? `${helpRequests.length} Ticket${helpRequests.length > 1 ? "s" : ""}`
                  : "0 Active Tickets"}
              </div>
              <div className={styles.deskSub}>
                {helpRequests.length > 0
                  ? `Latest: ${helpRequests[0].status}`
                  : "Request volunteer or staff assistance"}
              </div>
            </div>
          </div>

          {/* Secondary Features Hub Grid — 1-Tap Access */}
          <div className={styles.hubActionsGrid}>
            <div
              className={styles.hubActionCard}
              onClick={() => setActiveTab("schedule")}
            >
              <div className={styles.hubActionTitle}>
                <span>📅</span>
                <span>Event Schedule</span>
              </div>
              <div className={styles.hubActionSub}>
                Timeline & key milestone deadlines →
              </div>
            </div>

            <div
              className={styles.hubActionCard}
              onClick={() => setActiveTab("problems")}
            >
              <div className={styles.hubActionTitle}>
                <span>💡</span>
                <span>Problem Statements</span>
              </div>
              <div className={styles.hubActionSub}>
                Challenge briefs & track specs →
              </div>
            </div>

            <div
              className={styles.hubActionCard}
              onClick={() => setActiveTab("announcements")}
            >
              <div className={styles.hubActionTitle}>
                <span>📢</span>
                <span>Broadcasts ({announcements.length})</span>
              </div>
              <div className={styles.hubActionSub}>
                {announcements.length > 0
                  ? announcements[0].title
                  : "Latest organizer updates →"}
              </div>
            </div>

            {certificates.length > 0 && (
              <div
                className={styles.hubActionCard}
                onClick={() => setActiveTab("results")}
              >
                <div className={styles.hubActionTitle}>
                  <span>🎓</span>
                  <span>Certificates ({certificates.length})</span>
                </div>
                <div className={styles.hubActionSub}>
                  Official verified credentials →
                </div>
              </div>
            )}
          </div>

          {/* Venue Logistics Quick Guide (from Organizer Experience Builder) */}
          {expConfig.venueGuide && (
            <div className={styles.venueGuideCard}>
              <h3 className={styles.sectionTitle}>🏢 Venue Wi-Fi & Logistics</h3>
              <div className={styles.venueGrid}>
                {expConfig.venueGuide.wifiSsid && (
                  <div className={styles.venueItem}>
                    <span className={styles.venueLabel}>Wi-Fi Network</span>
                    <strong className={styles.venueValue}>{expConfig.venueGuide.wifiSsid}</strong>
                  </div>
                )}
                {expConfig.venueGuide.wifiPassword && (
                  <div className={styles.venueItem}>
                    <span className={styles.venueLabel}>Wi-Fi Password</span>
                    <strong className={styles.venueValue}>{expConfig.venueGuide.wifiPassword}</strong>
                  </div>
                )}
                {expConfig.venueGuide.foodTimings && (
                  <div className={styles.venueItem}>
                    <span className={styles.venueLabel}>Food & Refreshments</span>
                    <span className={styles.venueValue}>{expConfig.venueGuide.foodTimings}</span>
                  </div>
                )}
                {expConfig.venueGuide.emergencyHelpDesk && (
                  <div className={styles.venueItem}>
                    <span className={styles.venueLabel}>Physical Help Desk</span>
                    <span className={styles.venueValue}>{expConfig.venueGuide.emergencyHelpDesk}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: MY TEAM
          ============================================================ */}
      {activeTab === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.teamCard}>
            <div className={styles.teamHeader}>
              <div>
                <h2 className={styles.sectionTitle}>{team.name}</h2>
                <p className={styles.teamCollege}>
                  {team.college || "Independent Hackathon Team"} · {members.length} Members
                </p>
              </div>
              <span className={`${styles.statusPill} ${currentStatus.classColor}`}>
                {currentStatus.label}
              </span>
            </div>

            <div className={styles.memberList}>
              {members.map((m) => (
                <div key={m.id} className={styles.memberRow}>
                  <div className={styles.memberAvatar}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberName}>
                      {m.name}
                      {m.isLeader && <span className={styles.leaderBadge}>Leader</span>}
                    </div>
                    <div className={styles.memberEmail}>{m.email}</div>
                    {m.phone && <div className={styles.memberPhone}>{m.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Physical Desk Info */}
          {desk && (
            <div className={styles.metricCard}>
              <h3 className={styles.metricBadge}>Allocated Seating</h3>
              <div className={styles.deskBig} style={{ marginTop: "4px" }}>
                Room {desk.roomNumber} ({desk.roomName})
              </div>
              <p style={{ fontSize: "14px", color: "var(--color-ink-muted)", marginTop: "4px" }}>
                Assigned Desk <strong>#{desk.deskNumber}</strong> (Capacity: {desk.capacity} participants).
                Please remain at this desk during scheduled evaluation rounds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 3: MY PROJECT & SUBMISSION
          ============================================================ */}
      {activeTab === "project" && (
        <form onSubmit={handleSaveProject} className={styles.projectCard}>
          <div>
            <h2 className={styles.sectionTitle}>🚀 Project Deliverables & Submission</h2>
            <p style={{ fontSize: "13px", color: "var(--color-ink-muted)", margin: "4px 0 0" }}>
              Provide your public GitHub repository, demonstration links, and slide decks for judge evaluation.
            </p>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.modalField}>
              <label>Project Title / Problem Statement</label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. AI-Powered Venue Logistics Assistant"
                className={styles.select}
              />
            </div>

            <div className={styles.modalField}>
              <label>Public GitHub Repository URL *</label>
              <input
                type="url"
                required
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/organization/project"
                className={styles.select}
              />
            </div>

            <div className={styles.modalField}>
              <label>Live Demo / Video Link</label>
              <input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://youtu.be/... or https://demo.app"
                className={styles.select}
              />
            </div>

            <div className={styles.modalField}>
              <label>Presentation Slides (Google Slides / Canva / PPT)</label>
              <input
                type="url"
                value={pptUrl}
                onChange={(e) => setPptUrl(e.target.value)}
                placeholder="https://docs.google.com/presentation/..."
                className={styles.select}
              />
            </div>
          </div>

          <div className={styles.modalField}>
            <label>Project Description & Tech Stack</label>
            <textarea
              rows={4}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Explain the problem your project solves, architecture, APIs used, and key innovations..."
              className={styles.textarea}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", borderTop: "1px solid var(--color-hairline)", paddingTop: "var(--spacing-md)" }}>
            <span style={{ fontSize: "12px", color: submissionSaved ? "#34d399" : "var(--color-ink-muted)", fontWeight: 600 }}>
              {submissionSaved ? "✓ Deliverables Saved to Event Registry" : "💾 Auto-saves to your team profile"}
            </span>

            <button
              type="submit"
              disabled={submitting}
              className={styles.modalSubmitBtn}
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", padding: "10px 24px" }}
            >
              {submitting ? "Saving Deliverables..." : "Save Project Details 🚀"}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================
          TAB 4: UNIVERSAL QR PASS
          ============================================================ */}
      {activeTab === "pass" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--spacing-md)" }}>
          <div className={styles.qrCard}>
            <div className={styles.qrCardHeader}>
              <span className={styles.qrCardBadge}>Universal Access Pass</span>
              <h2 className={styles.qrTeamName}>{team.name}</h2>
              {desk && (
                <div className={styles.qrDeskHighlight}>
                  📍 Room {desk.roomNumber} ({desk.roomName}) · Desk #{desk.deskNumber}
                </div>
              )}
            </div>

            {/* High-Resolution QR */}
            <div className={styles.qrWrapper}>
              <img
                src={qrDataUrl}
                alt={`${team.name} Universal QR Pass`}
                className={styles.qrImage}
              />
            </div>

            <div className={styles.qrTokenDisplay}>
              <span>Token: {team.qrToken.slice(0, 18)}...</span>
              <button
                type="button"
                onClick={copyToken}
                className={styles.copyBtn}
              >
                {copiedToken ? "✓ Copied" : "Copy"}
              </button>
            </div>

            <p className={styles.qrInstruction}>
              Show this QR code to staff at venue entry gates or to evaluating judges at your desk.
            </p>

            <button
              type="button"
              onClick={downloadQR}
              disabled={downloading}
              className={styles.downloadPassBtn}
            >
              {downloading ? "Generating Image..." : "📥 Download Pass (PNG for Offline)"}
            </button>
          </div>

          {/* Wi-Fi Quick Access */}
          {expConfig.venueGuide?.wifiSsid && (
            <div className={styles.metricCard} style={{ width: "100%", maxWidth: "420px", textAlign: "center" }}>
              <span className={styles.metricBadge}>Venue Wi-Fi</span>
              <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
                SSID: {expConfig.venueGuide.wifiSsid}
              </div>
              <div style={{ fontSize: "14px", color: "#34d399", fontWeight: 600, marginTop: "2px" }}>
                Password: {expConfig.venueGuide.wifiPassword || "None"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 5: PROBLEM STATEMENTS
          ============================================================ */}
      {activeTab === "problems" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.header}>
            <button onClick={() => setActiveTab("home")} className={styles.backNavBtn} style={{ marginBottom: "6px" }}>
              ← Back to Dashboard
            </button>
            <h2 className={styles.sectionTitle}>💡 Problem Statements</h2>
            <p className={styles.subtitle}>
              Review released challenges and align your project with evaluation tracks.
            </p>
          </div>

          {countdown && (
            <div className={styles.revealBanner}>
              <div className={styles.revealTitle}>⏳ Timed Problem Statement Reveal</div>
              <div className={styles.revealTimer}>{countdown}</div>
              <p className={styles.revealDesc}>
                Official problem statements will unlock automatically when the round begins.
              </p>
            </div>
          )}

          {problems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
              {problems.map((p, idx) => (
                <div key={p.id} className={styles.teamCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span className={styles.statusPill} style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                      Track #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectTitle(p.title);
                        setActiveTab("project");
                        toast.success(`Selected "${p.title}"! Added to your project.`);
                      }}
                      className={styles.copyBtn}
                    >
                      Select Track →
                    </button>
                  </div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "8px 0 4px" }}>{p.title}</h3>
                  <p style={{ fontSize: "13.5px", color: "var(--color-ink-muted)", lineHeight: 1.5 }}>{p.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.metricCard} style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>💡</div>
              <h4>No Published Problem Statements Yet</h4>
              <p style={{ color: "var(--color-ink-muted)", fontSize: "13px" }}>
                Problem statements will appear here as soon as the event organizers release them.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 6: SCHEDULE
          ============================================================ */}
      {activeTab === "schedule" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.header}>
            <button onClick={() => setActiveTab("home")} className={styles.backNavBtn} style={{ marginBottom: "6px" }}>
              ← Back to Dashboard
            </button>
            <h2 className={styles.sectionTitle}>📅 Event Schedule & Timeline</h2>
            <p className={styles.subtitle}>Keep track of active milestones, meals, and evaluation windows.</p>
          </div>

          {expConfig.schedule && expConfig.schedule.length > 0 ? (
            <div className={styles.scheduleList}>
              {expConfig.schedule.map((item) => (
                <div key={item.id} className={styles.scheduleItem}>
                  <div className={styles.scheduleTimeBadge}>{item.time}</div>
                  <div className={styles.scheduleDetails}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h4 className={styles.scheduleTitle}>{item.title}</h4>
                      {item.phase && <span className={styles.schedulePhasePill}>{item.phase}</span>}
                    </div>
                    {item.description && (
                      <p className={styles.scheduleDesc}>{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.metricCard} style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
              <p style={{ color: "var(--color-ink-muted)" }}>Schedule details will be published by the event organizer shortly.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 7: ANNOUNCEMENTS
          ============================================================ */}
      {activeTab === "announcements" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.header}>
            <button onClick={() => setActiveTab("home")} className={styles.backNavBtn} style={{ marginBottom: "6px" }}>
              ← Back to Dashboard
            </button>
            <h2 className={styles.sectionTitle}>📢 Official Announcements</h2>
            <p className={styles.subtitle}>Broadcast alerts from the organizer command center.</p>
          </div>

          {announcements.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
              {announcements.map((a) => (
                <div key={a.id} className={styles.announcementCard}>
                  <div className={styles.announcementCardHeader}>
                    <span className={styles.priorityBadge}>{a.priority || "GENERAL"}</span>
                    <span className={styles.announcementTime}>
                      {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <h3 className={styles.announcementTitle}>{a.title}</h3>
                  <p className={styles.announcementContent}>{a.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.metricCard} style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
              <p style={{ color: "var(--color-ink-muted)" }}>No announcements broadcasted yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 8: HELP & SUPPORT TICKETS
          ============================================================ */}
      {activeTab === "support" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <button onClick={() => setActiveTab("home")} className={styles.backNavBtn} style={{ marginBottom: "6px" }}>
                ← Back to Dashboard
              </button>
              <h2 className={styles.sectionTitle}>🆘 Support & Help Desk</h2>
              <p className={styles.subtitle}>Dispatched volunteers and staff will assist you at your desk.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className={styles.modalSubmitBtn}
              style={{ padding: "10px 20px", fontSize: "13px" }}
            >
              + Request Assistance
            </button>
          </div>

          {helpRequests.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
              {helpRequests.map((req) => (
                <div key={req.id} className={styles.helpThreadCard}>
                  <div className={styles.helpHeader}>
                    <span className={styles.helpCategoryBadge}>
                      {CATEGORIES.find((c) => c.value === req.category)?.label || req.category}
                    </span>
                    <span
                      className={`${styles.statusPill} ${
                        req.status === "RESOLVED"
                          ? styles.statusSuccess
                          : req.status === "IN_PROGRESS"
                          ? styles.statusAccent
                          : styles.statusWarning
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className={styles.helpDesc}>{req.description}</p>
                  <div className={styles.helpMeta}>
                    <span>📍 {req.location || "General Venue"}</span>
                    <span>•</span>
                    <span>
                      {req.createdAt
                        ? new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Just now"}
                    </span>
                    {req.assignedStaff && (
                      <>
                        <span>•</span>
                        <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>
                          Staff Assigned: {req.assignedStaff.name || req.assignedStaff.email}
                        </span>
                      </>
                    )}
                  </div>

                  {req.resolutionNotes && (
                    <div className={styles.helpResolutionBox}>
                      <strong>Staff Remarks:</strong>
                      <p>{req.resolutionNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.metricCard} style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
              <p style={{ color: "var(--color-ink-muted)" }}>No help requests submitted yet.</p>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className={styles.modalSubmitBtn}
                style={{ marginTop: "12px", display: "inline-block" }}
              >
                Need Help? Create Ticket
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 9: RESULTS & CERTIFICATES
          ============================================================ */}
      {activeTab === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
          <div className={styles.header}>
            <button onClick={() => setActiveTab("home")} className={styles.backNavBtn} style={{ marginBottom: "6px" }}>
              ← Back to Dashboard
            </button>
            <h2 className={styles.sectionTitle}>🏆 Standings & Certificates</h2>
            <p className={styles.subtitle}>View your official results and verified participation certificates.</p>
          </div>

          {certificates.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
              {certificates.map((cert) => (
                <div key={cert.id} className={styles.certCard}>
                  <div>
                    <strong style={{ fontSize: "16px", color: "var(--color-ink)" }}>{cert.recipientName}</strong>
                    <div className={styles.certType}>{cert.type} Certificate</div>
                    <div className={styles.certCode}>Verification: {cert.verificationCode}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCert({
                        id: cert.id,
                        recipientName: cert.recipientName,
                        teamName: cert.teamName || team.name,
                        eventName: event.title,
                        eventSlug: event.slug,
                        type: cert.type,
                        verificationCode: cert.verificationCode,
                        generatedAt: cert.generatedAt,
                      })
                    }
                    className={styles.viewCertBtn}
                  >
                    View & Download Certificate 🎓
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.metricCard} style={{ textAlign: "center", padding: "var(--spacing-xl)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎓</div>
              <h4>Certificates Will Be Available Post-Event</h4>
              <p style={{ color: "var(--color-ink-muted)", fontSize: "13px" }}>
                Organizers will publish official verified certificates once final judging rounds conclude.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Request Help Modal */}
      {showHelpModal && (
        <div className={styles.modalOverlay} onClick={() => setShowHelpModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>🆘 Request Volunteer / Staff Assistance</h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className={styles.modalClose}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitHelp} className={styles.modalForm}>
              <div className={styles.modalField}>
                <label>Assigned Location (Auto-detected)</label>
                <input
                  type="text"
                  disabled
                  value={desk ? `Room ${desk.roomNumber} (${desk.roomName}) · Desk #${desk.deskNumber}` : "General Venue Area"}
                  className={styles.inputDisabled}
                />
              </div>

              <div className={styles.modalField}>
                <label>Issue Category</label>
                <select
                  value={helpCategory}
                  onChange={(e) => setHelpCategory(e.target.value)}
                  className={styles.select}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.modalField}>
                <label>Briefly Describe What You Need</label>
                <textarea
                  required
                  rows={3}
                  value={helpDescription}
                  onChange={(e) => setHelpDescription(e.target.value)}
                  placeholder="e.g. Wi-Fi keeps disconnecting at Desk 12, or need an extra power strip..."
                  className={styles.textarea}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className={styles.modalCancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingHelp}
                  className={styles.modalSubmitBtn}
                >
                  {submittingHelp ? "Dispatching..." : "Send Request 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Certificate Canvas Modal */}
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
