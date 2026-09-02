"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import styles from "./TopNav.module.css";

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Don't show nav on sign-in page
  if (pathname === "/auth/signin") return null;

  return (
    <nav className={styles.nav}>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <Link href={session ? "/events" : "/"} className={styles.logo}>
          HackFlow
        </Link>

        {/* Right section */}
        <div className={styles.right}>
          <ThemeToggle />

          {session?.user ? (
            <div className={styles.userSection}>
              <Link href="/events" className={styles.navLink}>
                Events
              </Link>
              <div className={styles.userMenu}>
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className={styles.avatar}
                    referrerPolicy="no-referrer"
                  />
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={styles.signOutBtn}
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <Link href="/auth/signin" className={styles.signInBtn}>
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
