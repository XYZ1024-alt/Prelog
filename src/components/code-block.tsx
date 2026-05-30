"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

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
  const label = getLanguageLabel(language);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPY_RESET_DELAY);
  }

  return (
    <div className="code-block">
      <div className="code-block__head">
        <span>{label}</span>
        <button aria-label="复制代码" onClick={copyCode} type="button">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "已复制" : "复制"}
        </button>
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
