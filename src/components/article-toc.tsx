"use client";

import { useEffect, useState } from "react";

import type { MarkdownHeading } from "@/lib/markdown-headings";

type ArticleTocProps = {
  readonly headings: readonly MarkdownHeading[];
};

export function ArticleToc({ headings }: ArticleTocProps) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");
  const [readingProgress, setReadingProgress] = useState(0);

  useActiveHeading(headings, setActiveId);
  useReadingProgress(setReadingProgress);

  return (
    <aside className="article-toc" aria-label="文章目录">
      <div className="article-toc__head">
        <span>Reading index</span>
        <strong>{String(readingProgress).padStart(2, "0")}%</strong>
      </div>
      <div
        aria-label="阅读进度"
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

const READING_START_VIEWPORT_RATIO = 0.22;
const READING_END_VIEWPORT_RATIO = 0.45;
const MIN_READING_DISTANCE_RATIO = 0.4;
const MAX_PROGRESS = 100;

function useReadingProgress(setProgress: (value: number) => void) {
  useEffect(() => {
    let frameId: number | null = null;

    function updateProgress() {
      frameId = null;
      const article = document.querySelector<HTMLElement>(".markdown-body");

      if (!article) {
        return;
      }

      const articleTop = window.scrollY + article.getBoundingClientRect().top;
      const viewportOffset = window.innerHeight * READING_START_VIEWPORT_RATIO;
      const minimumDistance = article.offsetHeight * MIN_READING_DISTANCE_RATIO;
      const readingDistance = Math.max(
        article.offsetHeight - window.innerHeight * READING_END_VIEWPORT_RATIO,
        minimumDistance,
      );
      const ratio = (window.scrollY + viewportOffset - articleTop) / readingDistance;
      setProgress(Math.round(Math.min(MAX_PROGRESS, Math.max(0, ratio * MAX_PROGRESS))));
    }

    function scheduleUpdate() {
      if (frameId === null) {
        frameId = window.requestAnimationFrame(updateProgress);
      }
    }

    updateProgress();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [setProgress]);
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
