"use client";

import { useEffect, useState } from "react";

import type { MarkdownHeading } from "@/lib/markdown-headings";

type ArticleTocProps = {
  readonly headings: readonly MarkdownHeading[];
};

export function ArticleToc({ headings }: ArticleTocProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useActiveHeading(headings, setActiveId);

  if (headings.length < MIN_TOC_HEADINGS) {
    return null;
  }

  const readingProgress = getHeadingProgress(headings, activeId);

  return (
    <aside className="article-toc" aria-label="文章目录">
      <div className="article-toc__head">
        <span>阅读目录</span>
        <strong>{String(readingProgress).padStart(2, "0")}%</strong>
      </div>
      <div
        aria-label="章节进度"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={readingProgress}
        className="article-toc__progress"
        role="progressbar"
      >
        <span style={{ transform: `scaleX(${readingProgress / MAX_PROGRESS})` }} />
      </div>
      {headings.length > 0 ? (
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
      ) : null}
    </aside>
  );
}

const MAX_PROGRESS = 100;
const MIN_TOC_HEADINGS = 2;

export function getHeadingProgress(headings: readonly MarkdownHeading[], activeId: string) {
  const activeIndex = headings.findIndex((heading) => heading.id === activeId);
  const lastIndex = headings.length - 1;

  if (activeIndex <= 0 || lastIndex <= 0) {
    return 0;
  }

  return Math.round((activeIndex / lastIndex) * MAX_PROGRESS);
}

function useActiveHeading(headings: readonly MarkdownHeading[], setActiveId: (id: string) => void) {
  useEffect(() => {
    const nodes = headings.map((heading) => findVisibleHeading(heading.id)).filter(isElement);

    if (nodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver((entries) => updateActiveId(entries, setActiveId), {
      rootMargin: "-20% 0px -45% 0px",
      threshold: [0, 1],
    });
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [headings, setActiveId]);
}

function findVisibleHeading(id: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(`#${CSS.escape(id)}`))
    .find((node) => !node.closest("[hidden]"));
}

function isElement(node: HTMLElement | null | undefined): node is HTMLElement {
  return node != null;
}

function updateActiveId(entries: readonly IntersectionObserverEntry[], setActiveId: (id: string) => void) {
  const visible = entries.find((entry) => entry.isIntersecting);

  if (visible?.target.id) {
    setActiveId(visible.target.id);
  }
}
