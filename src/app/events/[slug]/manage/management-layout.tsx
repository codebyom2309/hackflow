"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./manage-layout.module.css";

interface ManagementSidebarProps {
  eventTitle: string;
  eventSlug: string;
  eventStatus: string;
  children: React.ReactNode;
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  external?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV_ITEMS: NavSection[] = [
  {
    section: "Management",
    items: [
      { key: "overview", label: "Overview", icon: "📊", path: "" },
      { key: "import", label: "Import Data", icon: "📥", path: "/import" },
      { key: "teams", label: "Teams", icon: "👥", path: "/teams" },
    ],
  },
  {
    section: "Event Flow",
    items: [
      { key: "venue", label: "Venue & Desks", icon: "🏢", path: "/venue" },
      { key: "rounds", label: "Rounds", icon: "🔄", path: "/rounds" },
      { key: "judges", label: "Judges", icon: "⚖️", path: "/judges" },
    ],
  },
  {
    section: "Results",
    items: [
      { key: "results", label: "Results", icon: "🏆", path: "/results" },
      { key: "certificates", label: "Certificates", icon: "🎓", path: "/certificates" },
    ],
  },
  {
    section: "Communication",
    items: [
      { key: "announcements", label: "Announcements", icon: "📢", path: "/announcements" },
    ],
  },
  {
    section: "System",
    items: [
      { key: "audit", label: "Audit Log", icon: "📋", path: "/audit" },
      { key: "settings", label: "Settings", icon: "⚙️", path: "/settings" },
      { key: "exports", label: "Exports", icon: "⬇️", path: "/exports" },
    ],
  },
];

export default function ManagementLayout({
  eventTitle,
  eventSlug,
  eventStatus,
  children,
}: ManagementSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const basePath = `/events/${eventSlug}/manage`;

  function isActive(itemPath: string) {
    if (itemPath === "") {
      return pathname === basePath || pathname === basePath + "/";
    }
    return pathname.startsWith(basePath + itemPath);
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        className={styles.mobileToggle}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <h2 className={styles.brandTitle}>{eventTitle}</h2>
          <p className={styles.brandSubtitle}>Event Management</p>
          <span className={styles.statusPill}>
            {eventStatus.replace(/_/g, " ")}
          </span>
        </div>

        {NAV_ITEMS.map((section) => (
          <nav key={section.section} className={styles.navSection}>
            <div className={styles.navLabel}>{section.section}</div>
            {section.items.map((item) => {
              const href = item.external
                ? `/events/${eventSlug}${item.path}`
                : `${basePath}${item.path}`;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`${styles.navLink} ${isActive(item.path) ? styles.navLinkActive : ""}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ))}

        <div className={styles.sidebarFooter}>
          <Link href="/events" className={styles.backLink}>
            ← Back to Events
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.mainContent}>{children}</main>
    </>
  );
}
