"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { mounted, theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "切换到白色主题" : "切换到黑色主题";

  return (
    <button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label={mounted ? label : "切换主题"}>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">{mounted && dark ? <Moon size={16} /> : <Sun size={16} />}</span>
      </span>
    </button>
  );
}
