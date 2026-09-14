"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import CertificateCanvasModal, { CertificateData } from "@/components/certificates/certificate-canvas-modal";
import { useToast, ConfirmModal } from "@/components/ui";
import styles from "./certificates.module.css";
import type {
  CustomCertificateTemplate,
  CertificateVariableElement,
} from "@/lib/types/participant-experience";
import { DEFAULT_CERTIFICATE_ELEMENTS } from "@/lib/types/participant-experience";

interface CertificateRecord {
  id: string;
  eventId: string;
  teamId: string;
  teamName: string | null;
  recipientName: string;
  recipientEmail: string | null;
  type: string;
  verificationCode: string;
  generatedAt: string | null;
  downloadedAt: string | null;
  createdAt: string | null;
}

const PRESET_BACKGROUNDS = [
  { id: "luxury-gold", name: "🏆 Prestige Dark Gold", tone: "#090d1a", border: "#bf953f" },
  { id: "royal-ivory", name: "📜 Royal Parchment", tone: "#f8f5ee", border: "#854d0e" },
  { id: "cyber-neon", name: "⚡ Cyber Neon", tone: "#0a071b", border: "#06b6d4" },
  { id: "emerald-clean", name: "🌿 Clean Emerald", tone: "#062217", border: "#10b981" },
];

const SAMPLE_PREVIEW_DATA: Record<string, string> = {
  participant_name: "Sarah Jenkins",
  team_name: "Team QuantumLeap",
  certificate_type: "CERTIFICATE OF EXCELLENCE",
  event_name: "HackFlow Global 2026",
  issue_date: "September 15, 2026",
  verification_code: "HF-9824-A1B2-C3D4",
  qr_code: "QR_PLACEHOLDER",
  custom_text: "In Recognition of Outstanding Innovation & Prototype Execution",
};

export default function CertificateManager({
  slug,
  eventName = "Hackathon",
}: {
  slug: string;
  eventName?: string;
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"issued" | "canvas">("canvas");

  // Certificate list state
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [activeCert, setActiveCert] = useState<CertificateData | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  // Template Canvas Designer state
  const [template, setTemplate] = useState<CustomCertificateTemplate>({
    backgroundImageUrl: null,
    presetKey: "luxury-gold",
    canvasWidth: 2000,
    canvasHeight: 1414,
    elements: DEFAULT_CERTIFICATE_ELEMENTS,
  });

  const [selectedElementId, setSelectedElementId] = useState<string>("cert_recipient");
  const [useSampleData, setUseSampleData] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [bgImageName, setBgImageName] = useState<string>("");
  const [sidebarTab, setSidebarTab] = useState<"templates" | "variables">("templates");
  const [zoom, setZoom] = useState<number>(1);

  // Undo / Redo history
  const [history, setHistory] = useState<CustomCertificateTemplate[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragElementIdRef = useRef<string | null>(null);
  const bgImageObjRef = useRef<HTMLImageElement | null>(null);
  const guidesRef = useRef<{ x?: number; y?: number }>({});

  const pushToHistory = useCallback(
    (nextState: CustomCertificateTemplate) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, nextState].slice(-25);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 24));
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setTemplate(history[prevIdx]);
      toast.info("Undone");
    }
  }, [historyIndex, history, toast]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setTemplate(history[nextIdx]);
      toast.info("Redone");
    }
  }, [historyIndex, history, toast]);

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Load saved template
  const loadSavedTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/certificates/template`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.elements)) {
          setTemplate(json.data);
          setHistory([json.data]);
          setHistoryIndex(0);
          if (json.data.backgroundImageUrl) {
            setBgImageName("Custom Template Loaded");
          }
        }
      }
    } catch (err) {
      console.error("Failed to load saved template:", err);
    }
  }, [slug]);

  // Fetch certificates
  const fetchCertificates = useCallback(async () => {
    try {
      setFetching(true);
      const res = await fetch(`/api/events/${slug}/certificates`);
      if (res.ok) {
        const json = await res.json();
        setCertificates(json.data || []);
      }
    } catch {
      console.error("Failed to fetch certificates");
    } finally {
      setFetching(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCertificates();
    loadSavedTemplate();
  }, [fetchCertificates, loadSavedTemplate]);

  // Preload background image if any
  useEffect(() => {
    if (template.backgroundImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        bgImageObjRef.current = img;
        renderCanvas();
      };
      img.src = template.backgroundImageUrl;
    } else {
      bgImageObjRef.current = null;
      renderCanvas();
    }
  }, [template.backgroundImageUrl]);

  // Handle template image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP)");
      return;
    }

    setBgImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated = {
        ...template,
        backgroundImageUrl: dataUrl,
        presetKey: "custom" as any,
      };
      setTemplate(updated);
      pushToHistory(updated);
      toast.success(`Template "${file.name}" loaded successfully!`);
    };
    reader.readAsDataURL(file);
  };

  const removeUploadedImage = () => {
    setBgImageName("");
    const updated = {
      ...template,
      backgroundImageUrl: null,
      presetKey: "luxury-gold" as any,
    };
    setTemplate(updated);
    pushToHistory(updated);
    toast.info("Reverted to built-in template backdrop");
  };

  // Selected element helper
  const selectedElement = useMemo(
    () => template.elements.find((el) => el.id === selectedElementId) || template.elements[0],
    [template.elements, selectedElementId]
  );

  const updateSelectedElement = (updates: Partial<CertificateVariableElement>) => {
    const updated = {
      ...template,
      elements: template.elements.map((el) =>
        el.id === selectedElementId ? { ...el, ...updates } : el
      ),
    };
    setTemplate(updated);
  };

  const commitSelectedElementUpdate = (updates: Partial<CertificateVariableElement>) => {
    const updated = {
      ...template,
      elements: template.elements.map((el) =>
        el.id === selectedElementId ? { ...el, ...updates } : el
      ),
    };
    setTemplate(updated);
    pushToHistory(updated);
  };

  // Quick Layer Additions
  const addQuickLayer = (kind: "text" | "signature" | "seal" | "track") => {
    const id = `layer_${Date.now()}`;
    let newElem: CertificateVariableElement;
    if (kind === "signature") {
      newElem = {
        id,
        variable: "custom_text",
        label: "Authorized Signature",
        xPercent: 75,
        yPercent: 82,
        fontSize: 18,
        fontFamily: "Playfair Display",
        fontWeight: "normal",
        color: "#ffffff",
        align: "center",
        enabled: true,
        customText: "_______________________\nEvent Director & Jury Head",
        elementKind: "signature",
      };
    } else if (kind === "seal") {
      newElem = {
        id,
        variable: "custom_text",
        label: "Official Gold Seal",
        xPercent: 25,
        yPercent: 82,
        fontSize: 22,
        fontFamily: "Cinzel",
        fontWeight: "bold",
        color: "#bf953f",
        align: "center",
        enabled: true,
        customText: "★ OFFICIAL CREDENTIAL ★",
        elementKind: "seal",
        textTransform: "uppercase",
        letterSpacing: 2,
      };
    } else if (kind === "track") {
      newElem = {
        id,
        variable: "custom_text",
        label: "Award Track Category",
        xPercent: 50,
        yPercent: 44,
        fontSize: 24,
        fontFamily: "Outfit",
        fontWeight: "600",
        color: "#06b6d4",
        align: "center",
        enabled: true,
        customText: "Track: AI & Intelligent Agents",
        textTransform: "uppercase",
        letterSpacing: 2,
      };
    } else {
      newElem = {
        id,
        variable: "custom_text",
        label: "Custom Citation Layer",
        xPercent: 50,
        yPercent: 62,
        fontSize: 22,
        fontFamily: "Outfit",
        fontWeight: "normal",
        color: "#ffffff",
        align: "center",
        enabled: true,
        customText: "For Outstanding Architectural Innovation and Craft",
      };
    }
    const updated = { ...template, elements: [...template.elements, newElem] };
    setTemplate(updated);
    pushToHistory(updated);
    setSelectedElementId(id);
    toast.success(`Added ${newElem.label}!`);
  };

  const duplicateSelectedElement = () => {
    if (!selectedElement) return;
    const newId = `dup_${Date.now()}`;
    const clone: CertificateVariableElement = {
      ...selectedElement,
      id: newId,
      label: `${selectedElement.label} (Copy)`,
      xPercent: Math.min(94, selectedElement.xPercent + 3),
      yPercent: Math.min(94, selectedElement.yPercent + 3),
    };
    const updated = { ...template, elements: [...template.elements, clone] };
    setTemplate(updated);
    pushToHistory(updated);
    setSelectedElementId(newId);
    toast.success("Layer duplicated!");
  };

  const deleteSelectedElement = () => {
    if (!selectedElement) return;
    if (template.elements.length <= 1) {
      toast.warning("Cannot delete the only remaining layer");
      return;
    }
    const updated = {
      ...template,
      elements: template.elements.filter((el) => el.id !== selectedElement.id),
    };
    setTemplate(updated);
    pushToHistory(updated);
    setSelectedElementId(updated.elements[0]?.id || "");
    toast.info("Layer removed");
  };

  // Export Sample PNG
  const exportSamplePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const a = document.createElement("a");
      a.download = `HackFlow_Certificate_Sample.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success("High-resolution sample certificate exported!");
    } catch {
      toast.error("Failed to export sample image");
    }
  };

  // Render Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = template.canvasWidth || 2000;
    const height = template.canvasHeight || 1414;
    canvas.width = width;
    canvas.height = height;

    // 1. Draw Background
    if (bgImageObjRef.current) {
      // Draw uploaded custom template image
      ctx.drawImage(bgImageObjRef.current, 0, 0, width, height);
    } else {
      // Draw selected preset background
      const preset = PRESET_BACKGROUNDS.find((p) => p.id === template.presetKey) || PRESET_BACKGROUNDS[0];
      const grad = ctx.createLinearGradient(0, 0, width, height);

      if (preset.id === "royal-ivory") {
        grad.addColorStop(0, "#fbf8f1");
        grad.addColorStop(1, "#f3ede0");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = preset.border;
        ctx.lineWidth = 6;
        ctx.strokeRect(50, 50, width - 100, height - 100);
        ctx.lineWidth = 2;
        ctx.strokeRect(65, 65, width - 130, height - 130);
      } else if (preset.id === "cyber-neon") {
        grad.addColorStop(0, "#08051a");
        grad.addColorStop(0.5, "#0d0926");
        grad.addColorStop(1, "#04020a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
        ctx.lineWidth = 4;
        ctx.strokeRect(50, 50, width - 100, height - 100);
      } else if (preset.id === "emerald-clean") {
        grad.addColorStop(0, "#031710");
        grad.addColorStop(1, "#052217");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
        ctx.lineWidth = 4;
        ctx.strokeRect(50, 50, width - 100, height - 100);
      } else {
        // Luxury Gold
        grad.addColorStop(0, "#090d1a");
        grad.addColorStop(0.5, "#0e1529");
        grad.addColorStop(1, "#060912");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
        ctx.lineWidth = 4;
        ctx.strokeRect(50, 50, width - 100, height - 100);
        ctx.strokeStyle = "#bf953f";
        ctx.lineWidth = 2;
        ctx.strokeRect(65, 65, width - 130, height - 130);
      }
    }

    // 2. Draw Magnetic Snap Guides if active
    if (guidesRef.current.x !== undefined) {
      const guideX = (guidesRef.current.x / 100) * width;
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 6]);
      ctx.beginPath();
      ctx.moveTo(guideX, 0);
      ctx.lineTo(guideX, height);
      ctx.stroke();

      // Guide label badge
      ctx.fillStyle = "#ec4899";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`CENTER X: ${guidesRef.current.x}%`, guideX + 8, 30);
      ctx.restore();
    }

    if (guidesRef.current.y !== undefined) {
      const guideY = (guidesRef.current.y / 100) * height;
      ctx.save();
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 6]);
      ctx.beginPath();
      ctx.moveTo(0, guideY);
      ctx.lineTo(width, guideY);
      ctx.stroke();

      // Guide label badge
      ctx.fillStyle = "#ec4899";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`CENTER Y: ${guidesRef.current.y}%`, 30, guideY - 8);
      ctx.restore();
    }

    // 3. Draw Dynamic Elements
    template.elements.forEach((el) => {
      if (!el.enabled) return;

      const posX = (el.xPercent / 100) * width;
      const posY = (el.yPercent / 100) * height;

      ctx.save();
      ctx.textAlign = el.align;
      ctx.textBaseline = "middle";

      if (el.opacity !== undefined) {
        ctx.globalAlpha = el.opacity;
      }

      // Render Official Seal Stamp if kind === 'seal'
      if (el.elementKind === "seal") {
        const radius = (el.fontSize || 24) * 2.2;
        ctx.save();
        ctx.strokeStyle = el.color || "#bf953f";
        ctx.fillStyle = el.color || "#bf953f";

        // Outer serrated / double circle
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(posX, posY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(posX, posY, radius - 8, 0, Math.PI * 2);
        ctx.stroke();

        // Inner stars
        ctx.font = `bold ${Math.round(radius * 0.22)}px '${el.fontFamily || "Cinzel"}', serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★ ★ ★", posX, posY - radius * 0.35);

        // Center Seal text
        ctx.font = `bold ${Math.round(radius * 0.24)}px '${el.fontFamily || "Cinzel"}', serif`;
        ctx.fillText("VERIFIED", posX, posY);

        ctx.font = `600 ${Math.round(radius * 0.18)}px '${el.fontFamily || "Cinzel"}', serif`;
        ctx.fillText("CREDENTIAL", posX, posY + radius * 0.32);

        // Selection highlight if active
        if (el.id === selectedElementId) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(posX - radius - 8, posY - radius - 8, radius * 2 + 16, radius * 2 + 16);
        }
        ctx.restore();
        ctx.restore();
        return;
      }

      // Render QR Code
      if (el.variable === "qr_code") {
        const size = el.fontSize || 90;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(posX - size / 2, posY - size / 2, size, size);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeRect(posX - size / 2, posY - size / 2, size, size);

        // QR inner pattern
        ctx.fillStyle = "#000000";
        ctx.fillRect(posX - size / 2 + 8, posY - size / 2 + 8, 24, 24);
        ctx.fillRect(posX + size / 2 - 32, posY - size / 2 + 8, 24, 24);
        ctx.fillRect(posX - size / 2 + 8, posY + size / 2 - 32, 24, 24);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(posX - size / 2 + 14, posY - size / 2 + 14, 12, 12);
        ctx.fillRect(posX + size / 2 - 26, posY - size / 2 + 14, 12, 12);
        ctx.fillRect(posX - size / 2 + 14, posY + size / 2 - 26, 12, 12);

        // Selection highlight
        if (el.id === selectedElementId) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(posX - size / 2 - 8, posY - size / 2 - 8, size + 16, size + 16);
        }
        ctx.restore();
        return;
      }

      // Text variables & signatures
      let displayText = useSampleData
        ? (SAMPLE_PREVIEW_DATA[el.variable] || el.customText || `{{${el.variable}}}`)
        : `{{${el.variable}}}`;

      if (el.textTransform === "uppercase") displayText = displayText.toUpperCase();
      else if (el.textTransform === "capitalize") displayText = displayText.replace(/\b\w/g, (c) => c.toUpperCase());

      // Text Shadow / Outer Glow
      if (el.textShadow) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;
      }

      if (el.letterSpacing && (ctx as any).letterSpacing !== undefined) {
        (ctx as any).letterSpacing = `${el.letterSpacing}px`;
      }

      ctx.font = `${el.fontWeight || "normal"} ${el.fontSize}px '${el.fontFamily || "Inter"}', serif, sans-serif`;
      ctx.fillStyle = el.color || "#ffffff";

      // Support multiline text (e.g. for signatures)
      const lines = displayText.split("\n");
      const lineHeight = el.fontSize * 1.35;
      const totalH = lines.length * lineHeight;
      const startY = posY - (totalH - lineHeight) / 2;

      lines.forEach((line, idx) => {
        ctx.fillText(line, posX, startY + idx * lineHeight);
      });

      // Selection indicator box with 4 corner handles and top coordinate pill
      if (el.id === selectedElementId) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        let maxW = 0;
        lines.forEach((l) => {
          const w = ctx.measureText(l).width;
          if (w > maxW) maxW = w;
        });

        let left = posX;
        if (el.align === "center") left = posX - maxW / 2;
        else if (el.align === "right") left = posX - maxW;

        const boxW = maxW + 28;
        const boxH = totalH + 20;
        const boxX = left - 14;
        const boxY = startY - el.fontSize / 2 - 10;

        // Dashed bounding box
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // 4 Circular Corner Handles
        ctx.setLineDash([]);
        const handleR = 5;
        const corners = [
          [boxX, boxY],
          [boxX + boxW, boxY],
          [boxX, boxY + boxH],
          [boxX + boxW, boxY + boxH],
        ];

        corners.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, handleR, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        });

        // Top Floating Coordinate Badge
        const coordLabel = `${el.label} (X: ${el.xPercent}% · Y: ${el.yPercent}%)`;
        ctx.font = "bold 13px sans-serif";
        const badgeW = ctx.measureText(coordLabel).width + 18;
        const badgeH = 24;
        const badgeX = posX - badgeW / 2;
        const badgeY = boxY - badgeH - 6;

        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(coordLabel, posX, badgeY + badgeH / 2);
      }

      ctx.restore();
    });
  }, [template, selectedElementId, useSampleData]);

  // Re-render when dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Interactive Drag & Drop on Canvas with Magnetic Snap Guides
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Hit test elements
    const clickedElement = template.elements.find((el) => {
      if (!el.enabled) return false;
      const elX = (el.xPercent / 100) * canvas.width;
      const elY = (el.yPercent / 100) * canvas.height;
      const radius = Math.max(el.fontSize, 40);
      return Math.abs(mouseX - elX) < 180 && Math.abs(mouseY - elY) < radius;
    });

    if (clickedElement) {
      setSelectedElementId(clickedElement.id);
      isDraggingRef.current = true;
      dragElementIdRef.current = clickedElement.id;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !dragElementIdRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let newX = Math.max(2, Math.min(98, Math.round((mouseX / rect.width) * 100)));
    let newY = Math.max(2, Math.min(98, Math.round((mouseY / rect.height) * 100)));

    // Magnetic snap to center X (50%)
    if (Math.abs(newX - 50) <= 2) {
      newX = 50;
      guidesRef.current.x = 50;
    } else if (Math.abs(newX - 25) <= 1.5) {
      newX = 25;
      guidesRef.current.x = 25;
    } else if (Math.abs(newX - 75) <= 1.5) {
      newX = 75;
      guidesRef.current.x = 75;
    } else {
      guidesRef.current.x = undefined;
    }

    // Magnetic snap to center Y (50%)
    if (Math.abs(newY - 50) <= 2) {
      newY = 50;
      guidesRef.current.y = 50;
    } else {
      guidesRef.current.y = undefined;
    }

    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === dragElementIdRef.current
          ? { ...el, xPercent: newX, yPercent: newY }
          : el
      ),
    }));
  };

  const handleCanvasMouseUp = () => {
    guidesRef.current = {};
    if (isDraggingRef.current) {
      pushToHistory(template);
    }
    isDraggingRef.current = false;
    dragElementIdRef.current = null;
    renderCanvas();
  };

  // Save template configuration
  const saveTemplateConfig = async () => {
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/events/${slug}/certificates/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");

      toast.success("Certificate template & variable layout saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Execute batch generation
  const executeGenerate = async () => {
    setLoading(true);
    setConfirmGenerateOpen(false);
    try {
      const res = await fetch(`/api/events/${slug}/certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate certificates");

      toast.success(`Certificates issued successfully!`);
      fetchCertificates();
      setActiveTab("issued");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate certificates");
    } finally {
      setLoading(false);
    }
  };

  const filteredCerts = useMemo(() => {
    return certificates.filter((c) => {
      const matchSearch =
        c.recipientName.toLowerCase().includes(search.toLowerCase()) ||
        (c.teamName && c.teamName.toLowerCase().includes(search.toLowerCase())) ||
        c.verificationCode.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "ALL" || c.type === filterType;
      return matchSearch && matchType;
    });
  }, [certificates, search, filterType]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Certificates Studio</h1>
          <p className={styles.subtitle}>
            Upload your custom certificate design (Canva/Figma/Word) or use built-in presets, overlay dynamic variables, and issue cryptographically verifiable credentials.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.secondaryBtn}
            onClick={() => setActiveTab(activeTab === "canvas" ? "issued" : "canvas")}
          >
            {activeTab === "canvas" ? `📜 View Issued List (${certificates.length})` : "🎨 Open Template Studio"}
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => setConfirmGenerateOpen(true)}
            disabled={loading}
          >
            {loading ? "Generating..." : "✨ Generate All Certificates"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === "canvas" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("canvas")}
        >
          🎨 Certificate Template Studio & Variables
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "issued" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("issued")}
        >
          📜 Issued Certificates Roster ({certificates.length})
        </button>
      </div>

      {/* TAB 1: CERTIFICATE STUDIO (TEMPLATE & VARIABLES) */}
      {activeTab === "canvas" && (
        <div className={styles.studioWorkspace}>
          {/* Studio Top Toolbar */}
          <div className={styles.studioToolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.canvasSizeBadge}>📐 2000 × 1414 (A4 Landscape)</span>
              <div className={styles.undoRedoCapsule}>
                <button
                  type="button"
                  className={styles.toolIconBtn}
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  title="Undo last change (Ctrl+Z)"
                >
                  ↩ Undo
                </button>
                <button
                  type="button"
                  className={styles.toolIconBtn}
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  title="Redo (Ctrl+Y)"
                >
                  ↪ Redo
                </button>
              </div>
              <span style={{ fontSize: "12px", color: "var(--color-ink-muted)", fontWeight: 600 }}>
                {template.elements.filter((e) => e.enabled).length} Active Dynamic Layers
              </span>
            </div>

            <div className={styles.toolbarCenter}>
              <div className={styles.previewTogglePill}>
                <button
                  type="button"
                  className={`${styles.previewPillBtn} ${useSampleData ? styles.previewPillBtnActive : ""}`}
                  onClick={() => setUseSampleData(true)}
                >
                  👁️ Sample Data
                </button>
                <button
                  type="button"
                  className={`${styles.previewPillBtn} ${!useSampleData ? styles.previewPillBtnActive : ""}`}
                  onClick={() => setUseSampleData(false)}
                >
                  🏷️ Variable Keys
                </button>
              </div>

              {/* Zoom Controls */}
              <div className={styles.zoomCapsule}>
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                  title="Zoom Out"
                >
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.zoomBtn}
                  style={{ fontSize: "10px", padding: "2px 4px" }}
                  onClick={() => setZoom(1)}
                  title="Reset to 100%"
                >
                  Fit
                </button>
              </div>
            </div>

            <div className={styles.toolbarRight}>
              <button
                type="button"
                onClick={exportSamplePng}
                className={styles.exportSampleBtn}
                title="Download high-resolution sample PNG"
              >
                📸 Export Sample PNG
              </button>
              <button
                type="button"
                onClick={renderCanvas}
                className={styles.secondaryBtn}
                style={{ padding: "8px 14px", fontSize: "12px" }}
                title="Refresh preview"
              >
                🔄 Refresh
              </button>
              <button
                type="button"
                onClick={saveTemplateConfig}
                disabled={savingTemplate}
                className={styles.saveBtn}
              >
                {savingTemplate ? "Saving..." : "💾 Save Template"}
              </button>
            </div>
          </div>

          {/* 3-Column Studio Body */}
          <div className={styles.studioBody}>
            {/* Left Sidebar: Templates / Variables Library */}
            <div className={styles.leftSidebar}>
              <div className={styles.sidebarTabs}>
                <button
                  type="button"
                  className={`${styles.sidebarTabBtn} ${sidebarTab === "templates" ? styles.sidebarTabBtnActive : ""}`}
                  onClick={() => setSidebarTab("templates")}
                >
                  🖼️ Backdrop
                </button>
                <button
                  type="button"
                  className={`${styles.sidebarTabBtn} ${sidebarTab === "variables" ? styles.sidebarTabBtnActive : ""}`}
                  onClick={() => setSidebarTab("variables")}
                >
                  🔤 Variables
                </button>
              </div>

              {sidebarTab === "templates" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Custom Upload Dropzone */}
                  <input
                    type="file"
                    id="certBgInput"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="certBgInput" className={styles.uploadCard}>
                    <div className={styles.uploadIcon}>🎨</div>
                    <div className={styles.uploadTitle}>
                      {bgImageName || "Upload Custom Template"}
                    </div>
                    <div className={styles.uploadDesc}>
                      PNG, JPG or WEBP from Canva, Figma or Word
                    </div>
                  </label>

                  {template.backgroundImageUrl && (
                    <div className={styles.uploadedInfo}>
                      <span className={styles.uploadedName}>✓ Custom Image Active</span>
                      <button
                        type="button"
                        onClick={removeUploadedImage}
                        className={styles.removeImgBtn}
                        title="Remove uploaded image"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  )}

                  {/* Built-in Presets */}
                  <div className={styles.presetsSection}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginTop: "4px" }}>
                      OR SELECT A BUILT-IN BACKDROP:
                    </div>
                    <div className={styles.presetList}>
                      {PRESET_BACKGROUNDS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...template,
                              presetKey: p.id as any,
                              backgroundImageUrl: null,
                            };
                            setTemplate(updated);
                            pushToHistory(updated);
                          }}
                          className={`${styles.presetCard} ${
                            !template.backgroundImageUrl && template.presetKey === p.id
                              ? styles.presetCardActive
                              : ""
                          }`}
                        >
                          <div
                            className={styles.presetMiniPreview}
                            style={{
                              background: p.tone,
                              border: `1px solid ${p.border}`,
                              color: p.border,
                            }}
                          >
                            🏆
                          </div>
                          <div className={styles.presetTitle}>{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === "variables" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "11px", color: "var(--color-ink-muted)" }}>
                    Select a dynamic layer to edit coordinates & styling:
                  </div>
                  <div className={styles.variablesList}>
                    {template.elements.map((el) => (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`${styles.variableItem} ${
                          selectedElementId === el.id ? styles.variableItemActive : ""
                        }`}
                      >
                        <div className={styles.varLeft}>
                          <span className={styles.varIcon}>
                            {el.elementKind === "seal" ? "🎖️" : el.variable === "qr_code" ? "🏁" : "🔤"}
                          </span>
                          <div>
                            <div className={styles.varLabel}>{el.label}</div>
                            <div className={styles.varCode}>
                              {el.variable === "custom_text" ? el.customText?.slice(0, 16) : `{{${el.variable}}}`}
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={el.enabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            const updated = {
                              ...template,
                              elements: template.elements.map((item) =>
                                item.id === el.id ? { ...item, enabled: e.target.checked } : item
                              ),
                            };
                            setTemplate(updated);
                            pushToHistory(updated);
                          }}
                          title="Toggle element visibility"
                          style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Pre-styled Quick Layer Additions */}
                  <div style={{ marginTop: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: "4px" }}>
                      ADD PRE-STYLED LAYERS:
                    </div>
                    <div className={styles.quickAddGrid}>
                      <button
                        type="button"
                        className={styles.quickAddBtn}
                        onClick={() => addQuickLayer("text")}
                        title="Add Custom Citation Text"
                      >
                        <span>✍️</span> Custom Text
                      </button>
                      <button
                        type="button"
                        className={styles.quickAddBtn}
                        onClick={() => addQuickLayer("signature")}
                        title="Add Authorized Signature Line"
                      >
                        <span>✒️</span> Signature
                      </button>
                      <button
                        type="button"
                        className={styles.quickAddBtn}
                        onClick={() => addQuickLayer("seal")}
                        title="Add Verified Credential Gold Seal"
                      >
                        <span>🎖️</span> Gold Seal
                      </button>
                      <button
                        type="button"
                        className={styles.quickAddBtn}
                        onClick={() => addQuickLayer("track")}
                        title="Add Track or Award Category Badge"
                      >
                        <span>🏷️</span> Award Track
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Center Canvas Stage */}
            <div className={styles.canvasStage}>
              <div className={styles.canvasWrapper} style={{ overflow: "auto" }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  className={styles.interactiveCanvas}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s ease",
                  }}
                />
              </div>
              <div className={styles.canvasHintBar}>
                💡 <strong>Interactive Stage:</strong> Drag any layer directly · Auto-snaps to 50% Center · {Math.round(zoom * 100)}% Zoom
              </div>
            </div>

            {/* Right Inspector Panel */}
            <div className={styles.rightInspector}>
              {selectedElement ? (
                <>
                  <div className={styles.inspectorHeader}>
                    <div className={styles.inspectorTitle}>
                      Inspector: {selectedElement.label}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--color-ink-muted)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedElement.enabled}
                        onChange={(e) => commitSelectedElementUpdate({ enabled: e.target.checked })}
                        style={{ accentColor: "var(--color-accent)" }}
                      />
                      Active
                    </label>
                  </div>

                  {/* Position Controls */}
                  <div className={styles.inspectorGroup}>
                    <div className={styles.inspectorLabel}>Horizontal Position (X)</div>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedElement.xPercent}
                        onChange={(e) => updateSelectedElement({ xPercent: Number(e.target.value) })}
                        onMouseUp={() => pushToHistory(template)}
                        className={styles.sliderInput}
                      />
                      <span className={styles.sliderValue}>{selectedElement.xPercent}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => commitSelectedElementUpdate({ xPercent: 50 })}
                      className={styles.centerBtn}
                    >
                      🎯 Center Horizontally (50%)
                    </button>
                  </div>

                  <div className={styles.inspectorGroup}>
                    <div className={styles.inspectorLabel}>Vertical Position (Y)</div>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedElement.yPercent}
                        onChange={(e) => updateSelectedElement({ yPercent: Number(e.target.value) })}
                        onMouseUp={() => pushToHistory(template)}
                        className={styles.sliderInput}
                      />
                      <span className={styles.sliderValue}>{selectedElement.yPercent}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => commitSelectedElementUpdate({ yPercent: 50 })}
                      className={styles.centerBtn}
                    >
                      🎯 Center Vertically (50%)
                    </button>
                  </div>

                  {/* Size Slider */}
                  <div className={styles.inspectorGroup}>
                    <div className={styles.inspectorLabel}>
                      {selectedElement.variable === "qr_code" ? "QR Box Size" : "Font / Seal Size"}
                    </div>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        min={12}
                        max={selectedElement.variable === "qr_code" ? 180 : 96}
                        value={selectedElement.fontSize}
                        onChange={(e) => updateSelectedElement({ fontSize: Number(e.target.value) })}
                        onMouseUp={() => pushToHistory(template)}
                        className={styles.sliderInput}
                      />
                      <span className={styles.sliderValue}>{selectedElement.fontSize}px</span>
                    </div>
                  </div>

                  {/* Layer Opacity */}
                  <div className={styles.inspectorGroup}>
                    <div className={styles.inspectorLabel}>Layer Opacity</div>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round((selectedElement.opacity ?? 1) * 100)}
                        onChange={(e) => updateSelectedElement({ opacity: Number(e.target.value) / 100 })}
                        onMouseUp={() => pushToHistory(template)}
                        className={styles.sliderInput}
                      />
                      <span className={styles.sliderValue}>{Math.round((selectedElement.opacity ?? 1) * 100)}%</span>
                    </div>
                  </div>

                  {selectedElement.variable !== "qr_code" && (
                    <>
                      {/* Font Family */}
                      <div className={styles.inspectorGroup}>
                        <div className={styles.inspectorLabel}>Font Family</div>
                        <select
                          value={selectedElement.fontFamily}
                          onChange={(e) => commitSelectedElementUpdate({ fontFamily: e.target.value })}
                          className={styles.dropdownSelect}
                        >
                          <option value="Playfair Display">Playfair Display (Luxury Serif)</option>
                          <option value="Cinzel">Cinzel (Classical Engraved)</option>
                          <option value="Outfit">Outfit (Modern Tech Sans)</option>
                          <option value="Inter">Inter (Clean Neutral Sans)</option>
                          <option value="Courier New">Courier New (Monospace)</option>
                        </select>
                      </div>

                      {/* Font Weight */}
                      <div className={styles.inspectorGroup}>
                        <div className={styles.inspectorLabel}>Font Weight</div>
                        <div className={styles.segmentedButtons}>
                          {[
                            { val: "normal", label: "Regular" },
                            { val: "600", label: "Semi" },
                            { val: "bold", label: "Bold" },
                            { val: "800", label: "Black" },
                          ].map((w) => (
                            <button
                              key={w.val}
                              type="button"
                              className={`${styles.segmentBtn} ${
                                selectedElement.fontWeight === w.val ? styles.segmentBtnActive : ""
                              }`}
                              onClick={() => commitSelectedElementUpdate({ fontWeight: w.val as any })}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Letter Spacing */}
                      <div className={styles.inspectorGroup}>
                        <div className={styles.inspectorLabel}>Letter Spacing (Kerning)</div>
                        <div className={styles.sliderRow}>
                          <input
                            type="range"
                            min={0}
                            max={12}
                            value={selectedElement.letterSpacing || 0}
                            onChange={(e) => updateSelectedElement({ letterSpacing: Number(e.target.value) })}
                            onMouseUp={() => pushToHistory(template)}
                            className={styles.sliderInput}
                          />
                          <span className={styles.sliderValue}>{selectedElement.letterSpacing || 0}px</span>
                        </div>
                      </div>

                      {/* Text Transform */}
                      <div className={styles.inspectorGroup}>
                        <div className={styles.inspectorLabel}>Text Transform</div>
                        <div className={styles.segmentedButtons}>
                          {[
                            { val: "none", label: "Normal" },
                            { val: "uppercase", label: "UPPER" },
                            { val: "capitalize", label: "Title" },
                          ].map((t) => (
                            <button
                              key={t.val}
                              type="button"
                              className={`${styles.segmentBtn} ${
                                (selectedElement.textTransform || "none") === t.val ? styles.segmentBtnActive : ""
                              }`}
                              onClick={() => commitSelectedElementUpdate({ textTransform: t.val as any })}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Alignment */}
                      <div className={styles.inspectorGroup}>
                        <div className={styles.inspectorLabel}>Alignment</div>
                        <div className={styles.segmentedButtons}>
                          {[
                            { val: "left", label: "Left" },
                            { val: "center", label: "Center" },
                            { val: "right", label: "Right" },
                          ].map((a) => (
                            <button
                              key={a.val}
                              type="button"
                              className={`${styles.segmentBtn} ${
                                selectedElement.align === a.val ? styles.segmentBtnActive : ""
                              }`}
                              onClick={() => commitSelectedElementUpdate({ align: a.val as any })}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Drop Shadow Toggle */}
                      <div className={styles.inspectorGroup}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--color-ink)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={!!selectedElement.textShadow}
                            onChange={(e) => commitSelectedElementUpdate({ textShadow: e.target.checked })}
                            style={{ accentColor: "var(--color-accent)" }}
                          />
                          <span>Soft Dark Shadow (Enhanced Contrast)</span>
                        </label>
                      </div>

                      {/* Color Swatches */}
                      <div className={styles.inspectorGroup}>
                        <div className={styles.inspectorLabel}>Color</div>
                        <div className={styles.colorSwatches}>
                          <input
                            type="color"
                            value={selectedElement.color}
                            onChange={(e) => updateSelectedElement({ color: e.target.value })}
                            onBlur={() => pushToHistory(template)}
                            className={styles.colorPickerInput}
                          />
                          {["#ffffff", "#bf953f", "#f59e0b", "#94a3b8", "#10b981", "#06b6d4", "#ec4899", "#1e293b"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              style={{ background: c }}
                              className={styles.swatchBtn}
                              onClick={() => commitSelectedElementUpdate({ color: c })}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Custom text content if variable is custom_text */}
                      {selectedElement.variable === "custom_text" && (
                        <div className={styles.inspectorGroup}>
                          <div className={styles.inspectorLabel}>Custom Text / Subtitle</div>
                          <textarea
                            rows={2}
                            value={selectedElement.customText || ""}
                            onChange={(e) => updateSelectedElement({ customText: e.target.value })}
                            onBlur={() => pushToHistory(template)}
                            className={styles.dropdownSelect}
                            style={{ resize: "vertical", fontFamily: "inherit" }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Actions Row: Duplicate & Delete */}
                  <div className={styles.inspectorActionsRow}>
                    <button
                      type="button"
                      className={styles.duplicateBtn}
                      onClick={duplicateSelectedElement}
                      title="Duplicate this layer"
                    >
                      📋 Duplicate Layer
                    </button>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={deleteSelectedElement}
                      title="Delete this layer"
                    >
                      🗑️ Remove Layer
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--color-ink-muted)", fontSize: "12px", textAlign: "center", padding: "40px 10px" }}>
                  Select an element on the canvas or from the Variables tab to customize its styling and position.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ISSUED CERTIFICATES LIST */}
      {activeTab === "issued" && (
        <div className={styles.card}>
          {/* Filters */}
          <div className={styles.filterRow}>
            <input
              type="text"
              placeholder="Search recipient, team, or verification code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.filterPills}>
              {["ALL", "WINNER", "RUNNER_UP", "FINALIST", "PARTICIPANT"].map((t) => (
                <button
                  key={t}
                  className={`${styles.filterPill} ${filterType === t ? styles.filterPillActive : ""}`}
                  onClick={() => setFilterType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {fetching ? (
            <div className={styles.loadingState}>Loading certificates...</div>
          ) : filteredCerts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎓</div>
              <h3>No Certificates Issued Yet</h3>
              <p>
                Configure your template in the Studio tab above, then click &ldquo;Generate All Certificates&rdquo; to issue official credentials.
              </p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Team</th>
                    <th>Award / Type</th>
                    <th>Verification Code</th>
                    <th>Generated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.map((cert) => (
                    <tr key={cert.id}>
                      <td className={styles.recipientName}>{cert.recipientName}</td>
                      <td className={styles.teamCell}>{cert.teamName || "—"}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${styles[`type_${cert.type}`]}`}>
                          {cert.type}
                        </span>
                      </td>
                      <td className={styles.codeCell}>
                        <code>{cert.verificationCode}</code>
                      </td>
                      <td className={styles.dateCell}>
                        {cert.generatedAt ? new Date(cert.generatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <button
                          className={styles.viewBtn}
                          onClick={() =>
                            setActiveCert({
                              id: cert.id,
                              recipientName: cert.recipientName,
                              teamName: cert.teamName,
                              eventName,
                              type: cert.type,
                              verificationCode: cert.verificationCode,
                              generatedAt: cert.generatedAt,
                              eventSlug: slug,
                            })
                          }
                        >
                          👁️ View / Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmGenerateOpen && (
        <ConfirmModal
          isOpen={true}
          title="Generate Certificates for All Participants?"
          message="This will apply your configured template image and dynamic variables to all eligible participants, generate unique verification codes, and make credentials available in their companion app."
          confirmText="Generate Now"
          onConfirm={executeGenerate}
          onCancel={() => setConfirmGenerateOpen(false)}
        />
      )}

      {/* Canvas Print / Download Modal */}
      {activeCert && (
        <CertificateCanvasModal
          certificate={activeCert}
          onClose={() => setActiveCert(null)}
          eventSlug={slug}
        />
      )}
    </div>
  );
}
