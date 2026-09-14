"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import styles from "./TopNav.module.css";

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);

  // Extract event slug if inside an event route
  const eventMatch = pathname ? pathname.match(/^\/events\/([^/]+)/) : null;
  const eventSlug = eventMatch && eventMatch[1] !== "create" ? eventMatch[1] : null;

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Fetch role for active event context
  useEffect(() => {
    if (!eventSlug || !session?.user) {
      setUserRole(null);
      setEventTitle(null);
      return;
    }
    fetch(`/api/events/${eventSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          if (json.data.userRole) setUserRole(json.data.userRole);
          if (json.data.title) setEventTitle(json.data.title);
        }
      })
      .catch(() => {});
  }, [eventSlug, session?.user]);

  // Don't show nav on sign-in page
  if (pathname === "/auth/signin") return null;

  // Role metadata configurations
  const ROLE_CONFIGS: Record<
    string,
    { label: string; icon: string; defaultPath: string; classColor: string; links: Array<{ label: string; path: string }> }
  > = {
    ORGANIZER: {
      label: "Organizer",
      icon: "👑",
      defaultPath: `/events/${eventSlug}/manage`,
      classColor: styles.roleOrganizer,
      links: [
        { label: "Console", path: `/events/${eventSlug}/manage` },
        { label: "Experience Builder", path: `/events/${eventSlug}/manage/experience` },
        { label: "Help Desk", path: `/events/${eventSlug}/manage/help-desk` },
        { label: "Teams", path: `/events/${eventSlug}/manage/teams` },
        { label: "Rounds", path: `/events/${eventSlug}/manage/rounds` },
      ],
    },
    PARTICIPANT: {
      label: "Participant",
      icon: "🎒",
      defaultPath: `/events/${eventSlug}/dashboard`,
      classColor: styles.roleParticipant,
      links: [
        { label: "Pass & Dashboard", path: `/events/${eventSlug}/dashboard` },
        { label: "Event Details", path: `/events/${eventSlug}` },
      ],
    },
    JUDGE: {
      label: "Judge",
      icon: "⚖️",
      defaultPath: `/events/${eventSlug}/judge`,
      classColor: styles.roleJudge,
      links: [{ label: "Evaluation Queue", path: `/events/${eventSlug}/judge` }],
    },
    COORDINATOR: {
      label: "Coordinator / Staff",
      icon: "📱",
      defaultPath: `/events/${eventSlug}/coordinator`,
      classColor: styles.roleCoordinator,
      links: [
        { label: "Scanner & Roster", path: `/events/${eventSlug}/coordinator` },
      ],
    },
  };

  const activeRoleConfig = userRole ? ROLE_CONFIGS[userRole] : null;

  return (
    <>
      <nav className={styles.nav}>
        <div className={`container ${styles.inner}`}>
          {/* Brand & Active Event Context */}
          <div className={styles.left}>
            <Link href="/" className={styles.logo}>
              HackFlow
            </Link>
            <span className={styles.osBadge}>VENUE OS</span>

            {/* Event & Role Context Indicator */}
            {eventSlug && activeRoleConfig && (
              <div className={styles.contextBadge}>
                <span className={styles.contextDivider}>/</span>
                <Link
                  href={activeRoleConfig.defaultPath}
                  className={`${styles.rolePill} ${activeRoleConfig.classColor}`}
                  title={`Active Event: ${eventTitle || eventSlug}`}
                >
                  <span className={styles.roleIcon}>{activeRoleConfig.icon}</span>
                  <span className={styles.roleLabel}>{activeRoleConfig.label}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Center Links (Context-Aware) */}
          <div className={styles.centerLinks}>
            {eventSlug && activeRoleConfig ? (
              activeRoleConfig.links.map((link) => {
                const isActive =
                  link.path === `/events/${eventSlug}/manage`
                    ? pathname === link.path
                    : pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                  >
                    {link.label}
                  </Link>
                );
              })
            ) : (
              <>
                <Link
                  href="/"
                  className={`${styles.navLink} ${pathname === "/" ? styles.navLinkActive : ""}`}
                >
                  Overview
                </Link>
                <Link
                  href="/events"
                  className={`${styles.navLink} ${pathname === "/events" ? styles.navLinkActive : ""}`}
                >
                  {session ? "My Hub & Passes" : "Explore Hackathons"}
                </Link>
              </>
            )}
          </div>

          {/* Right section */}
          <div className={styles.right}>
            <ThemeToggle />

            {session?.user ? (
              <div className={styles.userSection}>
                <div className={styles.userMenu}>
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className={styles.avatar}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={styles.avatarFallback}>
                      {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{session.user.name || "Hacker"}</span>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className={styles.signOutBtn}
                    title="Sign Out"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.authButtons}>
                <Link href="/auth/signin?callbackUrl=/events" className={styles.signInBtn}>
                  Sign In
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileOpen(true)}
              aria-label="Open Navigation Menu"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setMobileOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerBrand}>
                <span className={styles.logo}>HackFlow</span>
                {activeRoleConfig && (
                  <span className={`${styles.rolePill} ${activeRoleConfig.classColor}`}>
                    {activeRoleConfig.icon} {activeRoleConfig.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerLinks}>
              {eventSlug && activeRoleConfig ? (
                <>
                  <div className={styles.drawerSectionTitle}>
                    {eventTitle || "Current Hackathon"}
                  </div>
                  {activeRoleConfig.links.map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      className={`${styles.drawerLink} ${
                        pathname.startsWith(link.path) ? styles.drawerLinkActive : ""
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className={styles.drawerSectionDivider} />
                  <Link href="/events" className={styles.drawerLink}>
                    ← Switch Event / Hub
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/"
                    className={`${styles.drawerLink} ${pathname === "/" ? styles.drawerLinkActive : ""}`}
                  >
                    Overview
                  </Link>
                  <Link
                    href="/events"
                    className={`${styles.drawerLink} ${pathname === "/events" ? styles.drawerLinkActive : ""}`}
                  >
                    {session ? "My Hub & Passes" : "Explore Hackathons"}
                  </Link>
                </>
              )}
            </div>

            {session?.user && (
              <div className={styles.drawerFooter}>
                <div className={styles.drawerUser}>
                  <div className={styles.drawerUserName}>{session.user.name || session.user.email}</div>
                  <div className={styles.drawerUserEmail}>{session.user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={styles.drawerSignOutBtn}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
