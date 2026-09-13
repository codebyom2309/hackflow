"use client";

import React, { useEffect } from "react";
import styles from "./ConfirmModal.module.css";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isDestructive?: boolean;
  inputConfig?: {
    label?: string;
    placeholder?: string;
    value: string;
    onChange: (val: string) => void;
    type?: string;
  };
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
  isDestructive = false,
  inputConfig,
  children,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const destructive = isDanger || isDestructive;
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleRow}>
          <span className={destructive ? styles.iconDanger : styles.iconWarning}>
            {destructive ? "⚠️" : "❓"}
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>

        {message && <p className={styles.message}>{message}</p>}

        {inputConfig && (
          <div className={styles.inputGroup}>
            {inputConfig.label && <label className={styles.inputLabel}>{inputConfig.label}</label>}
            <input
              type={inputConfig.type || "text"}
              value={inputConfig.value}
              placeholder={inputConfig.placeholder}
              onChange={(e) => inputConfig.onChange(e.target.value)}
              className={styles.inputField}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </div>
        )}

        {children}

        <div className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancelBtn}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${styles.confirmBtn} ${
              destructive ? styles.confirmDanger : styles.confirmPrimary
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
