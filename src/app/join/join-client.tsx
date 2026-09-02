"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./join.module.css";

interface PreviewData {
  token: string;
  role: string;
  eventTitle: string;
  eventSlug?: string;
  isRevoked: boolean;
  isExpired: boolean;
  isExhausted: boolean;
  valid: boolean;
}

interface JoinClientProps {
  token: string;
  preview: PreviewData | null;
  isAuthenticated: boolean;
}

export default function JoinClient({
  token,
  preview,
  isAuthenticated,
}: JoinClientProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Invitation Missing</h1>
        <p className={styles.desc}>
          No invitation token was found in this link. Please request a new link from
          the hackathon organizer.
        </p>
      </div>
    );
  }

  if (!preview || !preview.valid) {
    let reason = "This invitation is invalid.";
    if (preview?.isRevoked) reason = "This invitation has been revoked by the organizer.";
    else if (preview?.isExpired) reason = "This invitation link has expired.";
    else if (preview?.isExhausted) reason = "This invitation link has reached its maximum uses.";

    return (
      <div className={styles.card}>
        <div className={styles.errorIcon}>⚠️</div>
        <h1 className={styles.title}>Invitation Unavailable</h1>
        <p className={styles.desc}>{reason}</p>
        <button onClick={() => router.push("/")} className={styles.secondaryBtn}>
          Back to Home
        </button>
      </div>
    );
  }

  async function handleAccept() {
    if (!isAuthenticated) {
      signIn("google", { callbackUrl: `/join?token=${token}` });
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to accept invitation");
      }

      const role = preview?.role;
      const slug = json.data?.eventSlug || preview?.eventSlug;

      if (role === "COORDINATOR") {
        router.push(`/events/${slug}/coordinator`);
      } else if (role === "JUDGE") {
        router.push(`/events/${slug}/judge`);
      } else {
        router.push(`/events/${slug}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "An error occurred");
      setAccepting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.badge}>Staff Invitation</div>
      <h1 className={styles.title}>Join as {preview.role}</h1>
      <p className={styles.eventTitle}>{preview.eventTitle}</p>

      <div className={styles.roleBox}>
        <span className={styles.roleLabel}>Assigned Role</span>
        <span className={styles.roleValue}>{preview.role}</span>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.actions}>
        <button
          onClick={handleAccept}
          disabled={accepting}
          className={styles.acceptBtn}
        >
          {accepting
            ? "Joining..."
            : isAuthenticated
            ? `Accept & Join as ${preview.role}`
            : "Sign in with Google to Accept"}
        </button>
      </div>
    </div>
  );
}
