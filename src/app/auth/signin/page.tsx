"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "./signin.module.css";

type RoleOption = "ORGANIZER" | "PARTICIPANT" | "JUDGE" | "COORDINATOR";

const ROLE_CONFIG: Record<
  RoleOption,
  {
    icon: string;
    title: string;
    badge: string;
    description: string;
    buttonLabel: string;
    accent: string;
  }
> = {
  ORGANIZER: {
    icon: "👑",
    title: "Continue as Organizer",
    badge: "Control Center",
    description:
      "Create, configure, and manage hackathons, desk seating, judging rubrics, and published results.",
    buttonLabel: "Sign in as Organizer",
    accent: "#8b5cf6",
  },
  PARTICIPANT: {
    icon: "🎒",
    title: "Continue as Participant",
    badge: "Mobile Companion",
    description:
      "Access your assigned Room & Desk, persistent Universal QR Pass, problem statements, submissions, and help desk.",
    buttonLabel: "Sign in as Participant",
    accent: "#3b82f6",
  },
  JUDGE: {
    icon: "⚖️",
    title: "Continue as Judge",
    badge: "Evaluation Workspace",
    description:
      "Access assigned rounds, room-aware team rosters, GitHub demo links, and dynamic scoring rubrics.",
    buttonLabel: "Sign in as Judge",
    accent: "#10b981",
  },
  COORDINATOR: {
    icon: "📱",
    title: "Continue as Coordinator / Staff",
    badge: "Operations Desk",
    description:
      "High-speed camera QR scanner, manual team check-in, desk allocation lookup, and participant ticket triage.",
    buttonLabel: "Sign in as Coordinator",
    accent: "#f59e0b",
  },
};

function SignInContent() {
  const searchParams = useSearchParams();
  const initialRole = (searchParams.get("role")?.toUpperCase() as RoleOption) || "PARTICIPANT";
  const [selectedRole, setSelectedRole] = useState<RoleOption>(
    ROLE_CONFIG[initialRole] ? initialRole : "PARTICIPANT"
  );
  const callbackUrl = searchParams.get("callbackUrl");
  const error = searchParams.get("error");

  const effectiveCallback =
    callbackUrl && !callbackUrl.startsWith("/auth")
      ? callbackUrl
      : `/auth/resolve-role?role=${selectedRole}`;

  const currentRole = ROLE_CONFIG[selectedRole];

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        {/* Logo / Brand */}
        <div className={styles.brand}>
          <div className={styles.badgeTop}>Hackathon Management Platform</div>
          <h1 className={styles.logo}>HackFlow</h1>
          <p className={styles.tagline}>
            Select your role to access your dedicated application portal
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className={styles.error}>
            {error === "OAuthAccountNotLinked"
              ? "This email is already linked to another account."
              : "An error occurred during sign in. Please try again."}
          </div>
        )}

        {/* Role Selector Grid */}
        <div className={styles.roleGrid}>
          {(Object.keys(ROLE_CONFIG) as RoleOption[]).map((roleKey) => {
            const r = ROLE_CONFIG[roleKey];
            const isSelected = selectedRole === roleKey;
            return (
              <button
                key={roleKey}
                type="button"
                className={`${styles.roleCard} ${isSelected ? styles.roleCardActive : ""}`}
                onClick={() => setSelectedRole(roleKey)}
                style={{
                  borderColor: isSelected ? r.accent : undefined,
                  boxShadow: isSelected ? `0 0 0 1px ${r.accent}40, 0 8px 24px ${r.accent}20` : undefined,
                }}
              >
                <div className={styles.roleCardHeader}>
                  <span className={styles.roleIcon}>{r.icon}</span>
                  <span className={styles.roleBadge} style={{ color: r.accent, background: `${r.accent}15` }}>
                    {r.badge}
                  </span>
                </div>
                <div className={styles.roleTitle}>{r.title}</div>
                <div className={styles.roleDesc}>{r.description}</div>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className={styles.actionWrapper}>
          <button
            className={styles.googleButton}
            onClick={() => signIn("google", { callbackUrl: effectiveCallback })}
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>{currentRole.buttonLabel} with Google</span>
          </button>
        </div>

        <p className={styles.roleDisclaimer}>
          🔒 Your role access is strictly validated against event memberships in the database upon login.
        </p>

        <p className={styles.terms}>
          By signing in, you agree to our Terms of Service and Event Code of Conduct.
        </p>
      </div>

      {/* Decorative gradient orbs */}
      <div className={styles.orbViolet} />
      <div className={styles.orbMagenta} />
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <SignInContent />
    </Suspense>
  );
}
