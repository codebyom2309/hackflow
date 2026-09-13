import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { ne, desc } from "drizzle-orm";
import Link from "next/link";
import styles from "./home.module.css";

export const metadata = {
  title: "HackFlow — The Physical Hackathon Operating System",
  description: "Automated desk allocation, single-QR universal check-in & judging, dynamic evaluation matrices, and verified canvas certificates.",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  REGISTRATION_OPEN: { label: "Registration Open", color: "var(--color-success)" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "var(--color-warning)" },
  EVENT_READY: { label: "Event Ready", color: "var(--color-accent)" },
  ROUND_ACTIVE: { label: "Round Active", color: "var(--color-success)" },
  EVENT_COMPLETED: { label: "Completed", color: "var(--color-ink-muted)" },
};

export default async function HomePage() {
  const session = await auth();

  // Query discoverable public events
  let publicEvents: Array<typeof events.$inferSelect> = [];
  try {
    publicEvents = await db.query.events.findMany({
      where: ne(events.status, "DRAFT"),
      orderBy: [desc(events.createdAt)],
      limit: 6,
    });
  } catch (err) {
    console.error("Failed to load public events on home page", err);
  }

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />

        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span>⚡ THE PHYSICAL HACKATHON OPERATING SYSTEM</span>
          </div>

          <h1 className={styles.title}>
            Run your physical hackathon, <br />
            <span className={styles.titleGradient}>not your spreadsheets.</span>
          </h1>

          <p className={styles.subtitle}>
            Eliminate table chaos and check-in bottlenecks. Automated desk allocation,
            universal single-QR badges, real-time multi-round judging matrices, and
            instant verified certificates — engineered for venue-scale events.
          </p>

          <div className={styles.ctaGroup}>
            <Link href="/events" className={styles.primaryPill}>
              Explore Hackathons →
            </Link>
            {session ? (
              <Link href="/events" className={styles.secondaryPill}>
                My Hub & Passes
              </Link>
            ) : (
              <>
                <Link href="/auth/signin?callbackUrl=/events" className={styles.secondaryPill}>
                  Participant Sign In
                </Link>
                <Link href="/auth/signin?callbackUrl=/events" className={styles.secondaryPill}>
                  Host a Hackathon
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Role-Based Portals */}
      <section className={styles.portalsGrid}>
        {/* Participant Portal */}
        <div className={styles.portalCard}>
          <div className={styles.portalIcon}>🎒</div>
          <span className={styles.portalRole}>For Hackers & Teams</span>
          <h3 className={styles.portalTitle}>Participant Portal</h3>
          <p className={styles.portalDesc}>
            Access your team dashboard, persistent universal QR pass with offline download,
            physical room & desk allotment, live problem statements, and verifiable certificates.
          </p>
          <Link href="/events" className={styles.portalLink}>
            Open Participant Hub <span>→</span>
          </Link>
        </div>

        {/* Organizer Command Center */}
        <div className={styles.portalCard}>
          <div className={styles.portalIcon}>⚡</div>
          <span className={styles.portalRole}>For Event Organizers</span>
          <h3 className={styles.portalTitle}>Organizer Command Center</h3>
          <p className={styles.portalDesc}>
            Import spreadsheets (.xlsx) with auto-column mapping, design venue floor plans,
            trigger pessimistic-lock desk auto-allocation, configure evaluation criteria, and push live SSE announcements.
          </p>
          <Link href="/events" className={styles.portalLink}>
            Manage or Create Event <span>→</span>
          </Link>
        </div>

        {/* Judge & Staff Terminal */}
        <div className={styles.portalCard}>
          <div className={styles.portalIcon}>🛡️</div>
          <span className={styles.portalRole}>For Judges & Volunteers</span>
          <h3 className={styles.portalTitle}>Staff & Judging Terminal</h3>
          <p className={styles.portalDesc}>
            One universal QR scanner: volunteer coordinators rapidly confirm attendance and direct teams to tables;
            judges instantly load live scoring rubrics for assigned teams.
          </p>
          <Link href="/events" className={styles.portalLink}>
            Access Staff Terminal <span>→</span>
          </Link>
        </div>
      </section>

      {/* 4 Signature Atmospheric Gradient Spotlight Cards */}
      <section className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Core Architectural Innovations</span>
          <h2 className={styles.sectionTitle}>Built for High-Stakes In-Person Venues</h2>
          <p className={styles.sectionSubtitle}>
            Every feature is designed to eliminate spreadsheet bottlenecks, prevent scoring errors, and ensure seamless physical logistics.
          </p>
        </div>

        <div className={styles.spotlightGrid}>
          {/* Card 1: Violet Spotlight */}
          <div className={`${styles.spotlightCard} ${styles.cardViolet}`}>
            <div className={`${styles.cardGlowBlob} ${styles.blobViolet}`} />
            <div className={styles.spotlightTop}>
              <span className={styles.spotlightTag}>Physical Logistics</span>
              <h3 className={styles.spotlightTitle}>Automated Desk Allocation</h3>
              <p className={styles.spotlightDesc}>
                Pessimistic transactional locking allocates physical desks with room balancing,
                team size matching, and instant drag-and-drop reassignment. Zero double-booking, zero table conflicts.
              </p>
            </div>
            <div className={styles.spotlightBottom}>
              <div className={styles.spotlightBadge}>
                <span>📍 Room 3 · Desk D-14 · Capacity 4</span>
              </div>
            </div>
          </div>

          {/* Card 2: Magenta Spotlight */}
          <div className={`${styles.spotlightCard} ${styles.cardMagenta}`}>
            <div className={`${styles.cardGlowBlob} ${styles.blobMagenta}`} />
            <div className={styles.spotlightTop}>
              <span className={styles.spotlightTag}>Universal Badge Engine</span>
              <h3 className={styles.spotlightTitle}>Single-QR Dynamic Routing</h3>
              <p className={styles.spotlightDesc}>
                A single cryptographic QR token per team. When scanned by a Volunteer Coordinator,
                it records gate check-in and shows table routing. When scanned by a Judge, it loads the evaluation rubric.
              </p>
            </div>
            <div className={styles.spotlightBottom}>
              <div className={styles.spotlightBadge}>
                <span>⚡ 1 QR Code · 2 Roles · Instant Routing</span>
              </div>
            </div>
          </div>

          {/* Card 3: Sunset Orange Spotlight */}
          <div className={`${styles.spotlightCard} ${styles.cardOrange}`}>
            <div className={`${styles.cardGlowBlob} ${styles.blobOrange}`} />
            <div className={styles.spotlightTop}>
              <span className={styles.spotlightTag}>Fair Evaluation</span>
              <h3 className={styles.spotlightTitle}>Live Multi-Round Judging Matrix</h3>
              <p className={styles.spotlightDesc}>
                Custom weighted scoring criteria, quick-tap inputs, judge assignment pools, and dual-rank calculation
                with automated shortlisting to advance teams into elimination and finals.
              </p>
            </div>
            <div className={styles.spotlightBottom}>
              <div className={styles.spotlightBadge}>
                <span>🏆 Real-time Shortlisting & Normalized Scores</span>
              </div>
            </div>
          </div>

          {/* Card 4: Coral Spotlight */}
          <div className={`${styles.spotlightCard} ${styles.cardCoral}`}>
            <div className={`${styles.cardGlowBlob} ${styles.blobCoral}`} />
            <div className={styles.spotlightTop}>
              <span className={styles.spotlightTag}>Instant Credentials</span>
              <h3 className={styles.spotlightTitle}>Canvas Certificates & Verification</h3>
              <p className={styles.spotlightDesc}>
                Client-side HTML5 canvas rendering produces instant high-resolution credentials for Winners, Finalists,
                and Participants, backed by unique cryptographic verification codes and a public verification gateway.
              </p>
            </div>
            <div className={styles.spotlightBottom}>
              <div className={styles.spotlightBadge}>
                <span>🛡️ Tamper-Proof Cryptographic ID</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How HackFlow Operates - Timeline */}
      <section className={styles.sectionWrapper}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Operational Flow</span>
          <h2 className={styles.sectionTitle}>From Registration to Champion Ceremony</h2>
          <p className={styles.sectionSubtitle}>
            A synchronized sequence replacing fragile spreadsheets with hardened real-time workflows.
          </p>
        </div>

        <div className={styles.timelineGrid}>
          <div className={styles.timelineCard}>
            <span className={styles.timelineStep}>Stage 01</span>
            <h4 className={styles.timelineTitle}>Roster Sync & Import</h4>
            <p className={styles.timelineDesc}>
              Import Google Forms / Excel rosters with automatic header matching, duplicate validation, and team member mapping.
            </p>
          </div>

          <div className={styles.timelineCard}>
            <span className={styles.timelineStep}>Stage 02</span>
            <h4 className={styles.timelineTitle}>Smart Desk Auto-Allot</h4>
            <p className={styles.timelineDesc}>
              1-click desk allocation distributes registered teams across venue halls with room capacities and team clustering.
            </p>
          </div>

          <div className={styles.timelineCard}>
            <span className={styles.timelineStep}>Stage 03</span>
            <h4 className={styles.timelineTitle}>Gate Attendance</h4>
            <p className={styles.timelineDesc}>
              Participants present offline-saved QR passes. Volunteer cameras instantly confirm attendance and announce table numbers.
            </p>
          </div>

          <div className={styles.timelineCard}>
            <span className={styles.timelineStep}>Stage 04</span>
            <h4 className={styles.timelineTitle}>Rounds & Live Judging</h4>
            <p className={styles.timelineDesc}>
              Problem statement reveal timers, GitHub repo & PPT submissions, assigned judge evaluations with audit trails.
            </p>
          </div>

          <div className={styles.timelineCard}>
            <span className={styles.timelineStep}>Stage 05</span>
            <h4 className={styles.timelineTitle}>Results & Certificates</h4>
            <p className={styles.timelineDesc}>
              Publish final rankings, trigger celebratory confetti, and generate cryptographically verifiable canvas certificates.
            </p>
          </div>
        </div>
      </section>

      {/* Active Public Hackathons */}
      {publicEvents.length > 0 && (
        <section className={styles.sectionWrapper} id="explore">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Live On HackFlow</span>
            <h2 className={styles.sectionTitle}>Explore Active Hackathons</h2>
            <p className={styles.sectionSubtitle}>
              Browse upcoming and live competitions. Register your squad and get assigned your table.
            </p>
          </div>

          <div className={styles.eventsGrid}>
            {publicEvents.map((event) => {
              const status = STATUS_MAP[event.status] || {
                label: event.status.replace(/_/g, " "),
                color: "var(--color-ink-muted)",
              };

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className={styles.eventCard}
                >
                  <div>
                    <span
                      className={styles.eventStatusBadge}
                      style={{ color: status.color, borderColor: status.color }}
                    >
                      {status.label}
                    </span>
                    <h3 className={styles.eventTitle}>{event.title}</h3>
                    {event.description && (
                      <p className={styles.eventDesc}>{event.description}</p>
                    )}
                  </div>

                  <div className={styles.eventFooter}>
                    <span className={styles.eventMeta}>
                      {event.eventStarts
                        ? new Date(event.eventStarts).toLocaleDateString()
                        : "Date TBA"}
                      {event.maxTeams ? ` · ${event.maxTeams} Teams` : ""}
                    </span>
                    <span className={styles.eventAction}>View Event →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>HackFlow</div>
          <div className={styles.footerCopy}>
            &copy; {new Date().getFullYear()} HackFlow. Built for high-velocity physical hackathons.
          </div>
          <div className={styles.footerLinks}>
            <Link href="/events" className={styles.footerLink}>
              All Events
            </Link>
            <Link href="/auth/signin" className={styles.footerLink}>
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
