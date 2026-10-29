import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "theme";

function resolveThemeFromStorage(): { mode: ThemeMode; resolved: Theme } {
  if (typeof window === "undefined") {
    return { mode: "light", resolved: "light" };
  }

  const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem("elp_theme");
  if (saved === "light" || saved === "dark") {
    return { mode: saved, resolved: saved };
  }

  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    mode: saved === "system" ? "system" : prefersDark ? "dark" : "light",
    resolved: prefersDark ? "dark" : "light",
  };
}

function applyThemeToDOM(resolved: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }
}

// Chống nháy sáng (FOUC) ngay khi module được nạp trước khi React render
if (typeof window !== "undefined") {
  const { resolved } = resolveThemeFromStorage();
  applyThemeToDOM(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return resolveThemeFromStorage().mode;
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    const { resolved } = resolveThemeFromStorage();
    applyThemeToDOM(resolved);
    return resolved;
  });

  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem("elp_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (themeMode === "system") {
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  const setTheme = (newTheme: Theme) => {
    applyThemeToDOM(newTheme);
    setThemeModeState(newTheme);
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      localStorage.setItem("elp_theme", newTheme);
    } catch {}
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (mode === "system") {
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const next = prefersDark ? "dark" : "light";
      applyThemeToDOM(next);
      setThemeState(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, "system");
        localStorage.setItem("elp_theme", "system");
      } catch {}
    } else {
      applyThemeToDOM(mode);
      setThemeState(mode);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
        localStorage.setItem("elp_theme", mode);
      } catch {}
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyThemeToDOM(next);
      setThemeModeState(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        localStorage.setItem("elp_theme", next);
      } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setTheme, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
