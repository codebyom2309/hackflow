"use client";

import { useState, useEffect, useCallback } from "react";

type Theme = "night" | "day";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("night");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("hackflow-theme") as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "day"
      : "night";
    const initial = stored || preferred;
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("hackflow-theme", newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "night" ? "day" : "night");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, mounted };
}
