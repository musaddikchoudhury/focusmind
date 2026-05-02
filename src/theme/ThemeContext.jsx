/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";

// ── Theme definitions ──────────────────────────────────────────────────────
export const THEMES = {
  dark: {
    name: "Dark",
    icon: "🌙",
    vars: {
      "--bg":          "#020810",
      "--bg2":         "rgba(6,15,30,0.92)",
      "--bg3":         "rgba(255,255,255,0.025)",
      "--border":      "rgba(255,255,255,0.08)",
      "--border2":     "rgba(255,255,255,0.05)",
      "--text1":       "#f1f5f9",
      "--text2":       "#94a3b8",
      "--text3":       "#64748b",
      "--text4":       "#334155",
      "--text5":       "#1e3a5f",
      "--label":       "#94a3b8",   // readable label color
      "--muted":       "#64748b",   // readable muted
      "--tag-bg":      "rgba(255,255,255,0.06)",
      "--glass":       "rgba(6,15,30,0.88)",
      "--shadow":      "rgba(0,0,0,0.4)",
      "--focus":       "#00e5ff",
      "--panel":       "rgba(6,15,30,0.82)",
      "--panel2":      "rgba(10,20,42,0.92)",
      "--ticker-border":"rgba(255,255,255,0.07)",
      "--ticker-text": "#475569",
      "--grid-line":   "rgba(255,255,255,0.013)",
    }
  },
  light: {
    name: "Light",
    icon: "☀️",
    vars: {
      "--bg":          "#f0f4f8",
      "--bg2":         "rgba(255,255,255,0.95)",
      "--bg3":         "rgba(0,0,0,0.04)",
      "--border":      "rgba(0,0,0,0.1)",
      "--border2":     "rgba(0,0,0,0.07)",
      "--text1":       "#0f172a",
      "--text2":       "#334155",
      "--text3":       "#475569",
      "--text4":       "#64748b",
      "--text5":       "#94a3b8",
      "--label":       "#334155",
      "--muted":       "#475569",
      "--tag-bg":      "rgba(0,0,0,0.05)",
      "--glass":       "rgba(255,255,255,0.92)",
      "--shadow":      "rgba(0,0,0,0.12)",
      "--focus":       "#006b7a",
      "--panel":       "rgba(248,250,252,0.92)",
      "--panel2":      "rgba(255,255,255,0.98)",
      "--ticker-border":"rgba(0,0,0,0.08)",
      "--ticker-text": "#475569",
      "--grid-line":   "rgba(0,0,0,0.04)",
    }
  },
  beige: {
    name: "Warm",
    icon: "🌿",
    vars: {
      "--bg":          "#f5ede0",
      "--bg2":         "rgba(252,246,237,0.95)",
      "--bg3":         "rgba(139,90,43,0.06)",
      "--border":      "rgba(139,90,43,0.15)",
      "--border2":     "rgba(139,90,43,0.09)",
      "--text1":       "#2c1a0e",
      "--text2":       "#5c3d1e",
      "--text3":       "#7a5230",
      "--text4":       "#9a7050",
      "--text5":       "#b89070",
      "--label":       "#5c3d1e",
      "--muted":       "#7a5230",
      "--tag-bg":      "rgba(139,90,43,0.08)",
      "--glass":       "rgba(252,246,237,0.92)",
      "--shadow":      "rgba(100,60,20,0.15)",
      "--focus":       "#8b5a2b",
      "--panel":       "rgba(250,243,232,0.92)",
      "--panel2":      "rgba(255,250,242,0.98)",
      "--ticker-border":"rgba(139,90,43,0.12)",
      "--ticker-text": "#7a5230",
      "--grid-line":   "rgba(139,90,43,0.04)",
    }
  },
};

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() =>
    localStorage.getItem("focusmind_theme") || "dark"
  );

  const theme = THEMES[themeKey] || THEMES.dark;

  useEffect(() => {
    const root = document.documentElement;
    // Inject CSS variables
    Object.entries(theme.vars).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });
    // Set body background immediately (avoids flash)
    document.body.style.background = theme.vars["--bg"];
    document.body.setAttribute("data-theme", themeKey);
    localStorage.setItem("focusmind_theme", themeKey);
  }, [themeKey, theme]);

  const cycleTheme = () => {
    const keys = Object.keys(THEMES);
    const next = keys[(keys.indexOf(themeKey) + 1) % keys.length];
    setThemeKey(next);
  };

  return (
    <ThemeCtx.Provider value={{ themeKey, theme, cycleTheme, THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
}
