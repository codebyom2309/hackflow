"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import styles from "./TopNav.module.css";

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [portalOpen, setPortalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract event slug if inside an event route
  const eventMatch = pathname ? pathname.match(/^\/events\/([^/]+)/) : null;
  const eventSlug = eventMatch && eventMatch[1] !== "create" ? eventMatch[1] : null;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPortalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
    setPortalOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!eventSlug || !session?.user) {
      setUserRole(null);
      return;
    }
    fetch(`/api/events/${eventSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.userRole) {
          setUserRole(json.data.userRole);
        }
      })
      .catch(() => {});
  }, [eventSlug, session?.user]);

  // Don't show nav on sign-in page (AFTER all hooks have executed)
  if (pathname === "/auth/signin") return null;

  const allPortals = eventSlug
    ? [
        { label: "Organizer Console", icon: "👑", path: `/events/${eventSlug}/manage`, roles: ["ORGANIZER"] },
        { label: "Participant Dashboard", icon: "👤", path: `/events/${eventSlug}/dashboard`, roles: ["ORGANIZER", "PARTICIPANT"] },
        { label: "Coordinator Scanner", icon: "📱", path: `/events/${eventSlug}/coordinator`, roles: ["ORGANIZER", "COORDINATOR"] },
        { label: "Judge Scoring Desk", icon: "⚖️", path: `/events/${eventSlug}/judge`, roles: ["ORGANIZER", "JUDGE"] },
        { label: "Venue & Desks", icon: "🏢", path: `/events/${eventSlug}/venue`, roles: ["ORGANIZER"] },
        { label: "Live Results", icon: "🏆", path: `/events/${eventSlug}/results`, roles: ["ORGANIZER", "PARTICIPANT", "COORDINATOR", "JUDGE"] },
        { label: "Import & Form Sync", icon: "📥", path: `/events/${eventSlug}/manage/import`, roles: ["ORGANIZER"] },
      ]
    : [];

  const portals = allPortals.filter((p) => !userRole || p.roles.includes(userRole));
  const currentPortal = portals.find((p) => pathname.startsWith(p.path));

  return (
    <>
      <nav className={styles.nav}>
        <div className={`container ${styles.inner}`}>
          {/* Brand */}
          <div className={styles.left}>
            <Link href="/" className={styles.logo}>
              HackFlow
            </Link>
            <span className={styles.osBadge}>VENUE OS</span>

            {/* Event Breadcrumb & Portal Switcher */}
            {eventSlug && (
              <div className={styles.portalSwitcher} ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setPortalOpen(!portalOpen)}
                  className={styles.portalBtn}
                  title="Switch HackFlow Portals"
                >
                  <span>{currentPortal ? currentPortal.icon : "⚡"}</span>
                  <span>{currentPortal ? currentPortal.label : "Portals"}</span>
                  <span style={{ fontSize: "10px", opacity: 0.7 }}>▼</span>
                </button>

                {portalOpen && (
                  <div className={styles.portalDropdown}>
                    <div className={styles.portalDropdownHeader}>Switch View / Portal</div>
                    {portals.map((item) => {
                      const isActive = pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          className={`${styles.portalItem} ${isActive ? styles.portalItemActive : ""}`}
                          onClick={() => setPortalOpen(false)}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                          {isActive && <span style={{ marginLeft: "auto", fontSize: "11px" }}>✓</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center / Nav links */}
          <div className={styles.centerLinks}>
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
                  Sign In / Register
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
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
              <span className={styles.logo}>HackFlow</span>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerLinks}>
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

              {eventSlug && (
                <>
                  <div className={styles.portalDropdownHeader} style={{ marginTop: "1rem" }}>
                    Event Portals
                  </div>
                  {portals.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`${styles.drawerLink} ${
                        pathname.startsWith(item.path) ? styles.drawerLinkActive : ""
                      }`}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}
                </>
              )}
            </div>

            {session?.user && (
              <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--color-hairline)" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-ink)", marginBottom: "8px" }}>
                  {session.user.name || session.user.email}
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={styles.signOutBtn}
                  style={{ width: "100%", textAlign: "center", padding: "8px" }}
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

