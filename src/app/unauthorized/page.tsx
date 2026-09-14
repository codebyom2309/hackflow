import Link from "next/link";
import styles from "./unauthorized.module.css";

export const metadata = {
  title: "Access Restricted — HackFlow",
  description: "You do not have permission to access this portal or resource.",
};

type Params = {
  searchParams: Promise<{
    role?: string;
    required?: string;
    from?: string;
    slug?: string;
    reason?: string;
    email?: string;
  }>;
};

export default async function UnauthorizedPage({ searchParams }: Params) {
  const { role, required, from, slug, reason, email } = await searchParams;

  let portalLink = "/events";
  let portalLabel = "Back to Hackathons Hub";

  if (slug) {
    if (role === "PARTICIPANT") {
      portalLink = `/events/${slug}/dashboard`;
      portalLabel = "Go to Participant Companion";
    } else if (role === "JUDGE") {
      portalLink = `/events/${slug}/judge`;
      portalLabel = "Go to Judge Evaluation Portal";
    } else if (role === "COORDINATOR") {
      portalLink = `/events/${slug}/coordinator`;
      portalLabel = "Go to Coordinator Operations";
    } else if (role === "ORGANIZER") {
      portalLink = `/events/${slug}/manage`;
      portalLabel = "Go to Organizer Console";
    } else {
      portalLink = `/events/${slug}`;
      portalLabel = "Go to Event Overview";
    }
  }

  const isNotJudge = reason === "NOT_A_JUDGE";
  const isNotCoordinator = reason === "NOT_A_COORDINATOR";

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <span className={styles.icon}>{isNotJudge ? "⚖️" : isNotCoordinator ? "📱" : "🛡️"}</span>
        </div>

        <div className={styles.badge}>
          {isNotJudge || isNotCoordinator ? "ROLE VERIFICATION NOTICE" : "403 RESTRICTED ACCESS"}
        </div>

        <h1 className={styles.title}>
          {isNotJudge
            ? "No Judge Assignment Found"
            : isNotCoordinator
            ? "No Staff / Coordinator Role Found"
            : "Access Denied for this Role"}
        </h1>

        <p className={styles.description}>
          {isNotJudge ? (
            <>
              The email <strong>{email || "associated with your account"}</strong> has not been added as a Judge by any hackathon organizer. Judges must be invited or assigned by the event organizer before evaluating teams.
            </>
          ) : isNotCoordinator ? (
            <>
              The email <strong>{email || "associated with your account"}</strong> is not currently registered as an operational Coordinator or Staff member for any hackathon.
            </>
          ) : (
            <>
              You do not have authorization to access this specific HackFlow portal or feature.
              {required && (
                <span className={styles.requiredRole}>
                  {" "}This area is strictly reserved for <strong>{required}</strong> personnel.
                </span>
              )}
            </>
          )}
        </p>

        {role && (
          <div className={styles.roleBox}>
            <span className={styles.roleBoxLabel}>Requested Portal Role:</span>
            <span className={styles.roleBoxValue}>{role}</span>
          </div>
        )}

        <div className={styles.actions}>
          <Link href="/auth/signin" className={styles.primaryButton}>
            🔄 Switch Role or Account
          </Link>
          <Link href={portalLink} className={styles.secondaryButton}>
            {portalLabel}
          </Link>
        </div>

        <div className={styles.footerNote}>
          If an organizer invited you, please ask them to add your exact Google email (<strong>{email || "your current account"}</strong>) in their Organizer Console.
        </div>
      </div>
    </main>
  );
}
