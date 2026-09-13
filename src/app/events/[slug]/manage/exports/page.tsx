import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/services/event.service";
import { requireRole } from "@/lib/auth/guards";
import ManagementLayout from "../management-layout";

import styles from "../manage.module.css";

export const metadata = { title: "Data Exports — HackFlow" };
type Params = { params: Promise<{ slug: string }> };

export default async function ManageExportsPage({ params }: Params) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user?.id) redirect(`/auth/signin?callbackUrl=/events/${slug}/manage/exports`);
  const event = await getEventBySlug(slug);
  if (!event) redirect("/events");
  await requireRole(session.user.id, event.id, "ORGANIZER");

  const exports = [
    { label: "Teams Roster", desc: "Team names, track, leader email, college, desk assignments", type: "teams", icon: "👥" },
    { label: "Participants", desc: "All team members with emails, phones, leader flag", type: "participants", icon: "🧑‍💻" },
    { label: "Venue & Desks", desc: "Room and desk layout with team allocations", type: "venue", icon: "🏢" },
    { label: "Results & Scores", desc: "Rankings with scores and advancement status", type: "results", icon: "🏆" },
    { label: "Certificates", desc: "Certificate recipients with verification codes", type: "certificates", icon: "🎓" },
  ];

  return (
    <ManagementLayout eventTitle={event.title} eventSlug={event.slug} eventStatus={event.status}>
      <div className={styles.section} style={{ maxWidth: 760 }}>
        <div className={styles.sectionHeader}>
          <div>
            <h1 className={styles.title}>Data Exports</h1>
            <p className={styles.subtitle}>
              Download real-time event data as standardized CSV files for reporting, analytics, and institutional archival.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {exports.map((exp) => (
            <a
              key={exp.type}
              href={`/api/events/${slug}/export?type=${exp.type}`}
              download
              className={styles.roundCard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1.25rem 1.5rem",
                textDecoration: "none",
                transition: "transform var(--transition-fast), border-color var(--transition-fast)",
              }}
            >
              <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{exp.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--color-ink)", fontSize: "15px" }}>{exp.label}</div>
                <div style={{ fontSize: "13px", color: "var(--color-ink-muted)", marginTop: "2px" }}>{exp.desc}</div>
              </div>
              <span className={styles.secondaryBtn} style={{ fontSize: "12px", pointerEvents: "none" }}>
                ⬇ Export CSV
              </span>
            </a>
          ))}
        </div>
      </div>
    </ManagementLayout>
  );
}
