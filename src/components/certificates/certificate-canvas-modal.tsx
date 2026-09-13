"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./certificate-canvas-modal.module.css";

export interface CertificateData {
  id: string;
  recipientName: string;
  teamName?: string | null;
  eventName: string;
  type: string;
  verificationCode: string;
  generatedAt?: string | Date | null;
  eventSlug?: string;
}

interface CertificateCanvasModalProps {
  certificate: CertificateData;
  onClose: () => void;
  eventSlug?: string;
}

export default function CertificateCanvasModal({
  certificate,
  onClose,
  eventSlug,
}: CertificateCanvasModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const certTypeConfig: Record<
    string,
    { title: string; subtitle: string; ribbonColor: string; goldAccent: string }
  > = {
    WINNER: {
      title: "CERTIFICATE OF EXCELLENCE",
      subtitle: "FIRST PLACE WINNER & GRAND CHAMPION",
      ribbonColor: "#eab308",
      goldAccent: "#fde047",
    },
    RUNNER_UP: {
      title: "CERTIFICATE OF MERIT",
      subtitle: "FIRST RUNNER-UP HONORS",
      ribbonColor: "#a855f7",
      goldAccent: "#c084fc",
    },
    FINALIST: {
      title: "CERTIFICATE OF ACHIEVEMENT",
      subtitle: "TOP FINALIST HONORS",
      ribbonColor: "#6366f1",
      goldAccent: "#818cf8",
    },
    PARTICIPANT: {
      title: "CERTIFICATE OF PARTICIPATION",
      subtitle: "OFFICIAL HACKATHON PARTICIPANT",
      ribbonColor: "#10b981",
      goldAccent: "#34d399",
    },
    SPECIAL: {
      title: "SPECIAL JURY AWARD",
      subtitle: "EXEMPLARY INNOVATION & CRAFT",
      ribbonColor: "#f43f5e",
      goldAccent: "#fb7185",
    },
    VOLUNTEER: {
      title: "CERTIFICATE OF APPRECIATION",
      subtitle: "EXEMPLARY VOLUNTEER SERVICE",
      ribbonColor: "#06b6d4",
      goldAccent: "#22d3ee",
    },
    JUDGE: {
      title: "CERTIFICATE OF RECOGNITION",
      subtitle: "HONORABLE EVALUATOR & JUDGE",
      ribbonColor: "#f59e0b",
      goldAccent: "#fbbf24",
    },
    COORDINATOR: {
      title: "CERTIFICATE OF RECOGNITION",
      subtitle: "HACKATHON OPERATIONS COORDINATOR",
      ribbonColor: "#8b5cf6",
      goldAccent: "#a78bfa",
    },
  };

  const config =
    certTypeConfig[certificate.type] || certTypeConfig.PARTICIPANT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 2000;
    const height = 1400;
    canvas.width = width;
    canvas.height = height;

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#080c18");
    bgGrad.addColorStop(0.5, "#0b1222");
    bgGrad.addColorStop(1, "#05070d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Radial Glow
    const radial = ctx.createRadialGradient(
      width / 2,
      height / 2,
      100,
      width / 2,
      height / 2,
      800
    );
    radial.addColorStop(0, "rgba(99, 102, 241, 0.08)");
    radial.addColorStop(0.5, "rgba(234, 179, 8, 0.04)");
    radial.addColorStop(1, "transparent");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    // 2. Ornate Border
    // Outer hairline
    ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Inner gold border
    const goldGrad = ctx.createLinearGradient(60, 60, width - 60, height - 60);
    goldGrad.addColorStop(0, "#bf953f");
    goldGrad.addColorStop(0.25, "#fcf6ba");
    goldGrad.addColorStop(0.5, "#b38728");
    goldGrad.addColorStop(0.75, "#fbf5b7");
    goldGrad.addColorStop(1, "#aa771c");

    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 6;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    // Third thin inner line
    ctx.strokeStyle = "rgba(212, 175, 55, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(74, 74, width - 148, height - 148);

    // Corner Accents / Flourishes
    const drawCorner = (cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.strokeStyle = goldGrad;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(0, 0);
      ctx.lineTo(40, 0);
      ctx.stroke();

      // Inner diamond
      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(25, 10);
      ctx.lineTo(15, 20);
      ctx.lineTo(5, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawCorner(85, 85, 0);
    drawCorner(width - 85, 85, 90);
    drawCorner(width - 85, height - 85, 180);
    drawCorner(85, height - 85, 270);

    // 3. Brand Crest / Emblem
    const crestY = 175;
    ctx.save();
    ctx.textAlign = "center";

    // Logo Icon: Glowing diamond emblem
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.arc(width / 2, crestY, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#090d1a";
    ctx.font = "bold 28px 'Inter', sans-serif";
    ctx.fillText("⚡", width / 2, crestY + 10);

    // Org Tagline
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 18px 'Inter', system-ui, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText("HACKFLOW VERIFIED CREDENTIAL", width / 2, crestY + 65);
    ctx.letterSpacing = "0px";
    ctx.restore();

    // 4. Main Certificate Title
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = goldGrad;
    ctx.font = "bold 58px 'Georgia', serif";
    ctx.fillText(config.title, width / 2, 335);

    // Ribbon Subtitle
    ctx.fillStyle = config.goldAccent;
    ctx.font = "600 24px 'Inter', sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText(config.subtitle, width / 2, 385);
    ctx.letterSpacing = "0px";

    // Divider Line
    const divGrad = ctx.createLinearGradient(width / 2 - 250, 0, width / 2 + 250, 0);
    divGrad.addColorStop(0, "transparent");
    divGrad.addColorStop(0.5, "rgba(212, 175, 55, 0.8)");
    divGrad.addColorStop(1, "transparent");
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 250, 420);
    ctx.lineTo(width / 2 + 250, 420);
    ctx.stroke();

    // 5. "PROUDLY PRESENTED TO"
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 20px 'Inter', sans-serif";
    ctx.letterSpacing = "5px";
    ctx.fillText("THIS IS PROUDLY PRESENTED TO", width / 2, 480);
    ctx.letterSpacing = "0px";

    // 6. Recipient Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 82px 'Georgia', serif";
    ctx.shadowColor = "rgba(255, 255, 255, 0.25)";
    ctx.shadowBlur = 18;
    ctx.fillText(certificate.recipientName, width / 2, 600);
    ctx.shadowBlur = 0;

    // Line under name
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 350, 635);
    ctx.lineTo(width / 2 + 350, 635);
    ctx.stroke();

    // 7. Body Text
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "400 26px 'Inter', sans-serif";
    ctx.fillText(
      "for outstanding ingenuity, collaborative effort, and technical performance in",
      width / 2,
      710
    );

    // Event Name
    ctx.fillStyle = goldGrad;
    ctx.font = "bold 44px 'Georgia', serif";
    ctx.fillText(certificate.eventName, width / 2, 785);

    // Team Name
    if (certificate.teamName) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 24px 'Inter', sans-serif";
      ctx.fillText(
        `as a valued member of Team "${certificate.teamName}"`,
        width / 2,
        845
      );
    }

    // 8. Seal and Verification Badge (Bottom Center)
    const sealX = width / 2;
    const sealY = 1040;

    // Outer Seal Circle
    ctx.save();
    ctx.fillStyle = "rgba(212, 175, 55, 0.08)";
    ctx.beginPath();
    ctx.arc(sealX, sealY, 78, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(sealX, sealY, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Seal Inner Ring
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = goldGrad;
    ctx.textAlign = "center";
    ctx.font = "bold 24px 'Inter', sans-serif";
    ctx.fillText("OFFICIAL", sealX, sealY - 8);
    ctx.font = "bold 16px 'Inter', sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("VERIFIED", sealX, sealY + 16);
    ctx.letterSpacing = "0px";
    ctx.restore();

    // Verification Code & Link under seal
    ctx.fillStyle = "#64748b";
    ctx.font = "500 17px 'Inter', monospace";
    ctx.fillText(
      `Verification Code: ${certificate.verificationCode}`,
      width / 2,
      1170
    );

    ctx.font = "400 15px 'Inter', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(
      `Verify authenticity at: ${typeof window !== "undefined" ? window.location.origin : "hackflow.dev"}/verify/${certificate.verificationCode}`,
      width / 2,
      1200
    );

    // 9. Signatures
    // Left: Event Director
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(250, 1070);
    ctx.lineTo(550, 1070);
    ctx.stroke();

    // Script mock signature
    ctx.fillStyle = "rgba(253, 230, 138, 0.8)";
    ctx.font = "italic 32px 'Georgia', serif";
    ctx.fillText("Event Director", 400, 1050);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 18px 'Inter', sans-serif";
    ctx.fillText("HackFlow Organizing Team", 400, 1105);
    ctx.fillStyle = "#64748b";
    ctx.font = "400 15px 'Inter', sans-serif";
    ctx.fillText("Executive Committee", 400, 1130);

    // Right: Date & Lead Judge
    const issueDate = certificate.generatedAt
      ? new Date(certificate.generatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    ctx.beginPath();
    ctx.moveTo(width - 550, 1070);
    ctx.lineTo(width - 250, 1070);
    ctx.stroke();

    ctx.fillStyle = "rgba(253, 230, 138, 0.8)";
    ctx.font = "italic 32px 'Georgia', serif";
    ctx.fillText(issueDate, width - 400, 1050);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 18px 'Inter', sans-serif";
    ctx.fillText("Evaluation Board", width - 400, 1105);
    ctx.fillStyle = "#64748b";
    ctx.font = "400 15px 'Inter', sans-serif";
    ctx.fillText("Lead Adjudicator", width - 400, 1130);

    ctx.restore();
  }, [certificate, config]);

  // Download high-resolution PNG
  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const safeName = certificate.recipientName.replace(/\s+/g, "_");
      const link = document.createElement("a");
      link.download = `HackFlow_Certificate_${safeName}_${certificate.verificationCode}.png`;
      link.href = dataUrl;
      link.click();

      // Record download timestamp in API
      const slug = eventSlug || certificate.eventSlug;
      if (slug && certificate.id) {
        fetch(`/api/events/${slug}/certificates/${certificate.id}/download`, {
          method: "POST",
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to export certificate image", err);
    } finally {
      setDownloading(false);
    }
  }

  // Copy verification link
  function handleCopy() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/verify/${certificate.verificationCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.titleIcon}>🎓</span>
            <div>
              <h3 className={styles.title}>{certificate.recipientName}</h3>
              <p className={styles.subtitle}>
                {config.subtitle} · {certificate.eventName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Canvas Display */}
        <div className={styles.canvasContainer}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>

        {/* Action Controls */}
        <div className={styles.actions}>
          <div className={styles.verificationInfo}>
            <span>Verification:</span>
            <span className={styles.codeBadge}>
              {certificate.verificationCode}
            </span>
          </div>

          <div className={styles.buttonGroup}>
            <button onClick={handleCopy} className={styles.copyBtn}>
              {copied ? "✓ Link Copied!" : "📋 Copy Verify Link"}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={styles.downloadBtn}
            >
              {downloading ? "Generating..." : "⬇ Download Certificate (PNG)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
