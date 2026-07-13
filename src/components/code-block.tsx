"use client";

import { Check, Copy } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const label = getLanguageLabel(language);
  const copyLabel = copied ? "已复制代码" : "复制代码";

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      setCopied(false);
    }, COPY_RESET_DELAY);
  }

  return (
    <div className="code-block">
      <div className="code-block__head">
        <span>{label}</span>
        <button aria-label={copyLabel} data-copied={copied} onClick={copyCode} type="button">
          <span aria-hidden="true" className="code-block__copy-slot code-block__copy-slot--icon">
            <Copy className="code-block__copy-state code-block__copy-state--idle" size={14} />
            <Check className="code-block__copy-state code-block__copy-state--success" size={14} />
          </span>
          <span aria-hidden="true" className="code-block__copy-slot">
            <span className="code-block__copy-state code-block__copy-state--idle">复制</span>
            <span className="code-block__copy-state code-block__copy-state--success">已复制</span>
          </span>
        </button>
        <span aria-atomic="true" aria-live="polite" className="sr-only">
          {copied ? "代码已复制" : ""}
        </span>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function getLanguageLabel(language: string | undefined) {
  if (!language) {
    return "Code";
  }

  return LANGUAGE_LABELS[language.toLowerCase()] ?? language;
}
