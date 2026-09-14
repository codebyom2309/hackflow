"use client";

import { useState } from "react";
import styles from "./event-portal.module.css";
import type { ParticipantExperienceConfig } from "@/lib/types/participant-experience";

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
  experienceConfig?: ParticipantExperienceConfig | null;
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

export default function EventPortal({
  event,
  userRole,
  experienceConfig,
  currentUser,
}: EventPortalProps) {
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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
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
          message: "🎉 Team registered successfully! Redirecting to your team companion pass...",
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
      {/* Event Hero Banner */}
      <div className={styles.headerCard}>
        <div className={styles.headerGlow} />
        <div className={styles.statusRow}>
          <span className={styles.statusBadge}>{event.status.replace(/_/g, " ")}</span>
          {isExternal && <span className={styles.methodBadge}>External Registration</span>}
          {userRole && <span className={styles.roleBadge}>Role: {userRole}</span>}
        </div>

        <h1 className={styles.title}>
          {experienceConfig?.heroTitle || event.title}
        </h1>
        <p className={styles.description}>
          {experienceConfig?.heroTagline || event.description || "Welcome to HackFlow"}
        </p>

        <div className={styles.metaRow}>
          {event.eventStarts && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Starts</span>
              <span className={styles.metaValue}>
                {new Date(event.eventStarts).toLocaleString()}
              </span>
            </div>
          )}
          {event.eventEnds && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Ends</span>
              <span className={styles.metaValue}>
                {new Date(event.eventEnds).toLocaleString()}
              </span>
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
            <span className={styles.metaValue}>
              {minSize} – {maxSize} Members
            </span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`${styles.feedback} ${
            feedback.type === "success" ? styles.success : styles.error
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Organizer Configured Venue Logistics Section */}
      {experienceConfig?.venueGuide && (
        <div className={styles.venueGuideCard}>
          <h3 className={styles.sectionHeading}>🏢 Venue & Hacker Logistics</h3>
          <div className={styles.venueGrid}>
            <div className={styles.venueItem}>
              <span className={styles.venueItemLabel}>Location / Hall:</span>
              <strong>{experienceConfig.venueGuide.buildingName || "Main Hall"}</strong>
            </div>
            <div className={styles.venueItem}>
              <span className={styles.venueItemLabel}>Floor & Lab:</span>
              <strong>{experienceConfig.venueGuide.floorInfo || "Floor 2"}</strong>
            </div>
            <div className={styles.venueItem}>
              <span className={styles.venueItemLabel}>Event Wi-Fi:</span>
              <strong>
                {experienceConfig.venueGuide.wifiSsid || "Venue-Wi-Fi"} (PW:{" "}
                {experienceConfig.venueGuide.wifiPassword || "None"})
              </strong>
            </div>
            <div className={styles.venueItem}>
              <span className={styles.venueItemLabel}>Food & Catering:</span>
              <strong>{experienceConfig.venueGuide.foodTimings || "Provided on-site"}</strong>
            </div>
          </div>
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
        /* NATIVE REGISTRATION FORM */
        <form onSubmit={handleRegister} className={styles.form}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Register Your Team</h2>
            <p className={styles.formSubtitle}>
              Automatic desk pre-allotment will lock a physical table for your team upon registration.
            </p>
          </div>

          {/* Step 1: Team Basics */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionHeading}>1. Team Information</h3>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Team Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ByteCraft"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>College / Institution</label>
                <input
                  type="text"
                  placeholder="e.g. MIT, Stanford, IIT"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Chosen Track / Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className={styles.select}
                >
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Total Team Size ({minSize} - {maxSize}) *</label>
                <div className={styles.sizeSelector}>
                  {Array.from({ length: maxSize - minSize + 1 }, (_, i) => minSize + i).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleSizeChange(size)}
                      className={`${styles.sizeBtn} ${teamSize === size ? styles.sizeBtnActive : ""}`}
                    >
                      {size} {size === 1 ? "Hacker" : "Hackers"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Leader Info */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionHeading}>2. Team Leader Details</h3>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Leader Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Turing"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Leader Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="alex@domain.com"
                  value={leaderEmail}
                  onChange={(e) => setLeaderEmail(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Leader Phone (WhatsApp) *</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 555-0199"
                  value={leaderPhone}
                  onChange={(e) => setLeaderPhone(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Step 3: Members */}
          {teamSize > 1 && (
            <div className={styles.formSection}>
              <h3 className={styles.sectionHeading}>3. Team Members ({teamSize - 1} Additional)</h3>
              <div className={styles.membersList}>
                {Array.from({ length: teamSize - 1 }).map((_, idx) => (
                  <div key={idx} className={styles.memberCard}>
                    <span className={styles.memberTag}>Member #{idx + 2}</span>
                    <div className={styles.memberGrid}>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={members[idx]?.name || ""}
                        onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                        className={styles.input}
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={members[idx]?.email || ""}
                        onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                        className={styles.input}
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number (Optional)"
                        value={members[idx]?.phone || ""}
                        onChange={(e) => handleMemberChange(idx, "phone", e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.submitSection}>
            <button
              type="submit"
              disabled={registering}
              className={styles.registerBtn}
            >
              {registering ? "Securing Table & Registering..." : `Confirm & Register Team (${teamSize} Members) →`}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.closedCard}>
          <h3>Registration is currently closed for this event</h3>
          <p>Please check back later or contact event organizers for inquiries.</p>
        </div>
      )}

      {/* Schedule Timeline Section */}
      {experienceConfig?.schedule && experienceConfig.schedule.length > 0 && (
        <div className={styles.scheduleSection}>
          <h3 className={styles.sectionHeading}>⏱️ Hackathon Timeline</h3>
          <div className={styles.scheduleGrid}>
            {experienceConfig.schedule.map((item) => (
              <div key={item.id} className={styles.scheduleCard}>
                <span className={styles.scheduleTime}>{item.time}</span>
                <div>
                  <strong className={styles.scheduleTitle}>{item.title}</strong>
                  {item.phase && <span className={styles.schedulePhase}>{item.phase}</span>}
                  {item.description && <p className={styles.scheduleDesc}>{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules & Guidelines */}
      {experienceConfig?.rules && experienceConfig.rules.length > 0 && (
        <div className={styles.rulesSection}>
          <h3 className={styles.sectionHeading}>📜 Hackathon Rules & Guidelines</h3>
          <div className={styles.rulesGrid}>
            {experienceConfig.rules.map((rule) => (
              <div key={rule.id} className={styles.ruleCard}>
                <strong>{rule.title}</strong>
                <p>{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQs */}
      {experienceConfig?.faqs && experienceConfig.faqs.length > 0 && (
        <div className={styles.faqsSection}>
          <h3 className={styles.sectionHeading}>❓ Frequently Asked Questions</h3>
          <div className={styles.faqsGrid}>
            {experienceConfig.faqs.map((faq) => (
              <div key={faq.id} className={styles.faqCard}>
                <strong>{faq.question}</strong>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
