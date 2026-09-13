"use client";

import { useState } from "react";
import styles from "./event-portal.module.css";

interface EventPortalProps {
  event: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    status: string;
    maxTeams: number | null;
    minTeamSize: number;
    maxTeamSize: number;
    eventStarts: Date | string | null;
    eventEnds: Date | string | null;
    registrationOpens?: Date | string | null;
    registrationCloses?: Date | string | null;
    registrationMethod?: string | null;
    externalFormUrl?: string | null;
  };
  userRole: string | null;
  currentUser?: {
    id: string;
    name: string;
    email: string;
  };
}

interface MemberInput {
  name: string;
  email: string;
  phone: string;
}

const THEME_OPTIONS = [
  "AI & Autonomous Agents",
  "Web3, DeFi & Cryptography",
  "HealthTech & Life Sciences",
  "FinTech & Next-Gen Banking",
  "EdTech & Future of Learning",
  "CyberSecurity & Privacy",
  "Climate & Clean Energy",
  "Open Innovation",
];

export default function EventPortal({ event, userRole, currentUser }: EventPortalProps) {
  // Step 1: Team Info
  const [teamName, setTeamName] = useState("");
  const [college, setCollege] = useState("");
  const [theme, setTheme] = useState(THEME_OPTIONS[0]);

  // Team Size (between min and max)
  const minSize = Math.max(1, event.minTeamSize || 2);
  const maxSize = Math.min(10, event.maxTeamSize || 4);
  const [teamSize, setTeamSize] = useState<number>(Math.min(maxSize, Math.max(minSize, 4)));

  // Step 2: Leader Info
  const [leaderName, setLeaderName] = useState(currentUser?.name || "");
  const [leaderEmail, setLeaderEmail] = useState(currentUser?.email || "");
  const [leaderPhone, setLeaderPhone] = useState("");

  // Step 3: Dynamic Members (size - 1)
  const [members, setMembers] = useState<MemberInput[]>([
    { name: "", email: "", phone: "" },
    { name: "", email: "", phone: "" },
    { name: "", email: "", phone: "" },
  ]);

  const [registering, setRegistering] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [checkingSync, setCheckingSync] = useState(false);

  function handleSizeChange(newSize: number) {
    setTeamSize(newSize);
    const needed = newSize - 1;
    if (needed > members.length) {
      const added: MemberInput[] = Array.from({ length: needed - members.length }, () => ({
        name: "",
        email: "",
        phone: "",
      }));
      setMembers([...members, ...added]);
    }
  }

  function handleMemberChange(index: number, field: keyof MemberInput, val: string) {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || !leaderEmail.trim() || registering) return;

    setRegistering(true);
    setFeedback(null);

    // Prepare payload
    const finalMembers: Array<{ name: string; email?: string; phone?: string }> = [
      {
        name: leaderName.trim() || "Team Leader",
        email: leaderEmail.trim(),
        phone: leaderPhone.trim() || undefined,
      },
    ];

    for (let i = 0; i < teamSize - 1; i++) {
      const m = members[i];
      if (m && m.name.trim()) {
        finalMembers.push({
          name: m.name.trim(),
          email: m.email.trim() || undefined,
          phone: m.phone.trim() || undefined,
        });
      } else {
        finalMembers.push({
          name: `Team Member ${i + 2}`,
          email: undefined,
          phone: undefined,
        });
      }
    }

    try {
      const res = await fetch(`/api/events/${event.slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          leaderEmail: leaderEmail.trim(),
          leaderName: leaderName.trim() || undefined,
          leaderPhone: leaderPhone.trim() || undefined,
          college: college.trim() || undefined,
          theme: theme || undefined,
          teamSize,
          members: finalMembers,
        }),
      });

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Registration successful! Table desk locked. Opening your team dashboard...",
        });
        setTimeout(() => {
          window.location.href = `/events/${event.slug}/dashboard`;
        }, 1000);
      } else {
        const json = await res.json();
        setFeedback({
          type: "error",
          message: json.error || "Registration could not be completed. Please check your inputs.",
        });
        setRegistering(false);
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Network error during registration. Please check your internet connection.",
      });
      setRegistering(false);
    }
  }

  async function checkExternalRegistrationSync() {
    setCheckingSync(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/events/${event.slug}/register`);
      const json = await res.json();
      if (json.registered) {
        setFeedback({
          type: "success",
          message: "Team match found! Redirecting to your team dashboard...",
        });
        setTimeout(() => {
          window.location.href = `/events/${event.slug}/dashboard`;
        }, 800);
      } else {
        setFeedback({
          type: "error",
          message: `No team found matching ${currentUser?.email || "your email"}. If you recently submitted the Google Form, please wait for organizers to upload the spreadsheet.`,
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Failed to verify registration status. Please try again.",
      });
    } finally {
      setCheckingSync(false);
    }
  }

  const isRegistrationOpen =
    event.status === "REGISTRATION_OPEN" || event.status === "EVENT_READY";
  const isExternal = event.registrationMethod === "EXTERNAL";

  return (
    <div className={styles.container}>
      {/* Event Header Banner */}
      <div className={styles.headerCard}>
        <div className={styles.headerGlow} />
        <div className={styles.statusRow}>
          <span className={styles.statusBadge}>{event.status.replace(/_/g, " ")}</span>
          {isExternal && <span className={styles.methodBadge}>External Registration</span>}
          {userRole && <span className={styles.roleBadge}>Role: {userRole}</span>}
        </div>

        <h1 className={styles.title}>{event.title}</h1>
        {event.description && <p className={styles.description}>{event.description}</p>}

        <div className={styles.metaRow}>
          {event.eventStarts && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Starts</span>
              <span className={styles.metaValue}>{new Date(event.eventStarts).toLocaleString()}</span>
            </div>
          )}
          {event.eventEnds && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Ends</span>
              <span className={styles.metaValue}>{new Date(event.eventEnds).toLocaleString()}</span>
            </div>
          )}
          {event.maxTeams && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Team Cap</span>
              <span className={styles.metaValue}>{event.maxTeams} Teams Max</span>
            </div>
          )}
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Team Limits</span>
            <span className={styles.metaValue}>{minSize} – {maxSize} Members</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`${styles.feedback} ${feedback.type === "success" ? styles.success : styles.error}`}>
          {feedback.message}
        </div>
      )}

      {/* EXTERNAL REGISTRATION VIEW */}
      {isExternal ? (
        <div className={styles.externalCard}>
          <div className={styles.externalHeader}>
            <div className={styles.externalIcon}>📋</div>
            <div>
              <h2 className={styles.externalTitle}>External Form Registration</h2>
              <p style={{ color: "var(--color-ink-muted)", fontSize: "14px" }}>
                This event manages team entry via an external application form.
              </p>
            </div>
          </div>

          <p className={styles.externalText}>
            Team registrations for this hackathon are processed through an official external form (Google Form / Unstop / Devfolio). If you have not registered your team yet, please submit your application using the link below:
          </p>

          <div className={styles.externalActions}>
            {event.externalFormUrl ? (
              <a
                href={event.externalFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalBtn}
              >
                Open Official Registration Form ↗
              </a>
            ) : (
              <span style={{ color: "var(--color-ink-muted)", fontSize: "14px" }}>
                Official registration link will be announced soon.
              </span>
            )}

            <button
              type="button"
              className={styles.checkStatusBtn}
              onClick={checkExternalRegistrationSync}
              disabled={checkingSync}
            >
              {checkingSync ? "Checking Roster..." : "Check Registration Status"}
            </button>
          </div>

          <div className={styles.syncHelpCard}>
            <div className={styles.syncHelpTitle}>💡 How External Sync Works</div>
            <p>
              Once the event organizers upload or sync the registration spreadsheet into HackFlow, your team will be automatically verified!
              Simply make sure you are signed in with the <strong>same email address ({currentUser?.email || "your email"})</strong> that you submitted in the form, and your QR pass and table desk will appear immediately.
            </p>
          </div>
        </div>
      ) : isRegistrationOpen ? (
        /* NATIVE MULTI-MEMBER REGISTRATION VIEW */
        <div className={styles.regCard}>
          <div className={styles.regHeader}>
            <h2 className={styles.regTitle}>Register Your Team</h2>
            <p className={styles.regSubtitle}>
              Provide your team roster to reserve your physical desk and generate your universal QR pass.
            </p>
          </div>

          <form onSubmit={handleRegister} className={styles.form}>
            {/* Section 1: Team & Project Scope */}
            <div className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>1</span>
                <span className={styles.sectionName}>Team Profile & Track</span>
              </div>

              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Team Name *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Binary Beasts"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>College / University *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. University of Engineering & Management"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Domain / Hackathon Track</label>
                  <select
                    className={styles.select}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    {THEME_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Squad Size ({minSize} to {maxSize} members)</label>
                  <div className={styles.sizePills}>
                    {Array.from({ length: maxSize - minSize + 1 }, (_, idx) => minSize + idx).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`${styles.sizePill} ${teamSize === size ? styles.sizePillActive : ""}`}
                        onClick={() => handleSizeChange(size)}
                      >
                        {size} Hackers
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Team Leader */}
            <div className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>2</span>
                <span className={styles.sectionName}>Team Leader (Primary Contact)</span>
              </div>

              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Leader Full Name *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Full name"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Leader Email Address *</label>
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="leader@example.com"
                    value={leaderEmail}
                    onChange={(e) => setLeaderEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Leader Phone / WhatsApp *</label>
                <input
                  type="tel"
                  className={styles.input}
                  placeholder="+91 98765 43210 (For table calls & urgent notices)"
                  value={leaderPhone}
                  onChange={(e) => setLeaderPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Section 3: Dynamic Members */}
            {teamSize > 1 && (
              <div className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionNumber}>3</span>
                  <span className={styles.sectionName}>Team Members ({teamSize - 1} Hackers)</span>
                </div>

                {Array.from({ length: teamSize - 1 }).map((_, idx) => {
                  const member = members[idx] || { name: "", email: "", phone: "" };
                  return (
                    <div key={idx} className={styles.memberCard}>
                      <div className={styles.memberCardTitle}>
                        <span>👤 Member {idx + 2}</span>
                      </div>

                      <div className={styles.grid2}>
                        <div className={styles.field}>
                          <label className={styles.label}>Member Name *</label>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder={`Member ${idx + 2} full name`}
                            value={member.name}
                            onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                            required
                          />
                        </div>

                        <div className={styles.field}>
                          <label className={styles.label}>Member Email (For their pass login)</label>
                          <input
                            type="email"
                            className={styles.input}
                            placeholder="member@example.com"
                            value={member.email}
                            onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              disabled={registering || !teamName.trim() || !leaderEmail.trim()}
              className={styles.submitBtn}
            >
              {registering ? "Locking Table & Registering..." : "Submit Registration & Lock Desk →"}
            </button>
          </form>
        </div>
      ) : (
        <div className={styles.noticeCard}>
          <div className={styles.noticeIcon}>🔒</div>
          <h3 className={styles.noticeTitle}>Registration Closed</h3>
          <p className={styles.noticeText}>
            Registration for this event is currently <strong>{event.status.replace(/_/g, " ").toLowerCase()}</strong>. Please reach out to the event organizers for inquiries.
          </p>
        </div>
      )}
    </div>
  );
}
