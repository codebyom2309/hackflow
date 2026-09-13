"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastMethods {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  custom: (item: Omit<ToastItem, "id">) => void;
}

export type ToastContextType = ToastMethods & {
  toast: ToastMethods;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };
      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (message: string, title = "Success") => addToast("success", message, title),
    error: (message: string, title = "Error") => addToast("error", message, title, 5000),
    warning: (message: string, title = "Notice") => addToast("warning", message, title),
    info: (message: string, title = "Info") => addToast("info", message, title),
    custom: (item: Omit<ToastItem, "id">) =>
      addToast(item.type, item.message, item.title, item.duration ?? 4000),
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
    }
  };

  const getTypeClass = (type: ToastType) => {
    switch (type) {
      case "success":
        return styles.toastSuccess;
      case "error":
        return styles.toastError;
      case "warning":
        return styles.toastWarning;
      case "info":
        return styles.toastInfo;
    }
  };

  const contextValue: ToastContextType = {
    ...toast,
    toast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${getTypeClass(t.type)}`}>
            <span className={styles.icon}>{getIcon(t.type)}</span>
            <div className={styles.content}>
              {t.title && <div className={styles.title}>{t.title}</div>}
              <div className={styles.message}>{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className={styles.closeBtn}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    const noopMethods: ToastMethods = {
      success: (msg: string) => console.log("[Toast Success]", msg),
      error: (msg: string) => console.error("[Toast Error]", msg),
      warning: (msg: string) => console.warn("[Toast Warning]", msg),
      info: (msg: string) => console.info("[Toast Info]", msg),
      custom: (item) => console.log("[Toast]", item),
    };
    return {
      ...noopMethods,
      toast: noopMethods,
    };
  }
  return context;
}
