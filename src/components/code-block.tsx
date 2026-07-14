"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CodeBlockProps = {
  readonly code: string;
  readonly language?: string;
};

const COPY_RESET_DELAY = 1400;

const LANGUAGE_LABELS: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  json: "JSON",
  md: "Markdown",
  prisma: "Prisma",
  sh: "Shell",
  shell: "Shell",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
};

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimerRef = useRef<number | null>(null);
  const label = getLanguageLabel(language);
  const copyLabel = getCopyLabel(copyState);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      scheduleReset("copied");
    } catch (error) {
      console.error("Code copy failed.", error);
      scheduleReset("error");
    }
  }

  function scheduleReset(state: "copied" | "error") {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    setCopyState(state);
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      setCopyState("idle");
    }, COPY_RESET_DELAY);
  }

  return (
    <div className="code-block">
      <div className="code-block__head">
        <span>{label}</span>
        <button aria-label={copyLabel} data-copy-state={copyState} onClick={copyCode} type="button">
          <span aria-hidden="true" className="code-block__copy-slot code-block__copy-slot--icon">
            <Copy className="code-block__copy-state code-block__copy-state--idle" size={14} />
            <Check className="code-block__copy-state code-block__copy-state--success" size={14} />
            <CircleAlert className="code-block__copy-state code-block__copy-state--error" size={14} />
          </span>
          <span aria-hidden="true" className="code-block__copy-slot">
            <span className="code-block__copy-state code-block__copy-state--idle">复制</span>
            <span className="code-block__copy-state code-block__copy-state--success">已复制</span>
            <span className="code-block__copy-state code-block__copy-state--error">复制失败</span>
          </span>
        </button>
        <span aria-atomic="true" aria-live="polite" className="sr-only">
          {copyState === "copied" ? "代码已复制" : null}
          {copyState === "error" ? "代码复制失败，请重试" : null}
        </span>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function getCopyLabel(state: "idle" | "copied" | "error") {
  if (state === "copied") return "已复制代码";
  if (state === "error") return "复制代码失败，请重试";
  return "复制代码";
}

function getLanguageLabel(language: string | undefined) {
  if (!language) {
    return "代码";
  }

  return LANGUAGE_LABELS[language.toLowerCase()] ?? language;
}
