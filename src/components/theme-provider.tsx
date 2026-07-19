"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useClientMounted } from "@/components/use-client-mounted";

type Theme = "dark" | "light" | "system";

type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
};

const STORAGE_KEY = "prelog-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_CYCLE: Record<Theme, Theme> = { dark: "system", light: "dark", system: "light" };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const mounted = useClientMounted();

  useEffect(() => {
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mounted,
      toggleTheme: () => setTheme((current) => THEME_CYCLE[current]),
    }),
    [mounted, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  const initialized = document.documentElement.dataset.theme;

  if (initialized === "light" || initialized === "dark") {
    return initialized;
  }

  return "system";
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
