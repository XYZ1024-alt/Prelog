"use client";

import { useEffect, useState } from "react";

import type { MarkdownHeading } from "@/lib/markdown-headings";

type ArticleTocProps = {
  readonly headings: readonly MarkdownHeading[];
};

export function ArticleToc({ headings }: ArticleTocProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useActiveHeading(headings, setActiveId);

  if (headings.length === 0) {
    return null;
  }

  return (
    <aside className="article-toc" aria-label="文章目录">
      <span>目录</span>
      <nav>
        {headings.map((heading) => (
          <a
            className={heading.id === activeId ? "is-active" : undefined}
            data-level={heading.level}
            href={`#${heading.id}`}
            key={heading.id}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function useActiveHeading(headings: readonly MarkdownHeading[], setActiveId: (id: string) => void) {
  useEffect(() => {
    const nodes = headings.map((heading) => document.getElementById(heading.id)).filter(isElement);

    if (nodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver((entries) => updateActiveId(entries, setActiveId), {
      rootMargin: "-22% 0px -62% 0px",
      threshold: [0, 1],
    });
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [headings, setActiveId]);
}

function isElement(node: HTMLElement | null): node is HTMLElement {
  return node !== null;
}

function updateActiveId(entries: readonly IntersectionObserverEntry[], setActiveId: (id: string) => void) {
  const visible = entries.find((entry) => entry.isIntersecting);

  if (visible?.target.id) {
    setActiveId(visible.target.id);
  }
}
