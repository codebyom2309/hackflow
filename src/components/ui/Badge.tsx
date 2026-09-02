import styles from "./Badge.module.css";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "error" | "accent";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export default function Badge({
  variant = "default",
  size = "sm",
  children,
}: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${styles[size]}`}>
      {children}
    </span>
  );
}
