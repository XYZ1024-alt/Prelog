"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

const THEME_LABELS = {
  dark: "深色主题",
  light: "浅色主题",
  system: "跟随系统主题",
} as const;

export function ThemeToggle() {
  const { mounted, theme, toggleTheme } = useTheme();
  const label = `主题：${THEME_LABELS[theme]}，点击切换`;

  return (
    <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label={mounted ? label : "切换主题"}>
      <span className="theme-toggle__icons" aria-hidden="true">
        <Monitor className="theme-toggle__icon theme-toggle__icon--system" size={17} />
        <Sun className="theme-toggle__icon theme-toggle__icon--sun" size={17} />
        <Moon className="theme-toggle__icon theme-toggle__icon--moon" size={17} />
      </span>
    </button>
  );
}
