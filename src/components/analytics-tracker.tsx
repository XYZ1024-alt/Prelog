"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { PUBLIC_ADMIN_PATH } from "@/lib/admin-path";

type AnalyticsEvent =
  | { readonly path: string; readonly referrer?: string; readonly type: "PAGE_VIEW" }
  | { readonly depth: "25" | "50" | "90"; readonly path: string; readonly type: "READ_DEPTH" }
  | { readonly path: string; readonly query: string; readonly type: "SEARCH" | "SEARCH_ZERO" };

const ANALYTICS_ENDPOINT = "/api/analytics";
const EXCLUDED_PREFIXES = Array.from(new Set([PUBLIC_ADMIN_PATH, "/admin", "/api", "/preview"]));
const READ_DEPTHS = ["25", "50", "90"] as const;
const SEARCH_QUERY_MAX = 80;
const eventRegistry = createAnalyticsEventRegistry();
let hasReportedDocumentReferrer = false;

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const navigationKey = queryString ? `${pathname}?${queryString}` : pathname;
    const excluded = shouldSkipAnalyticsPath(pathname);
    eventRegistry.begin(excluded ? "excluded-navigation" : navigationKey);

    if (excluded) {
      return;
    }

    const referrer = hasReportedDocumentReferrer ? undefined : document.referrer;
    hasReportedDocumentReferrer = true;
    reportOnce({ path: pathname, referrer, type: "PAGE_VIEW" }, navigationKey);
    reportSearch(pathname, new URLSearchParams(queryString), navigationKey);

    if (!pathname.startsWith("/posts/")) {
      return;
    }

    return trackReadDepth(pathname);
  }, [pathname, queryString]);

  return null;
}

function reportSearch(path: string, searchParams: URLSearchParams, navigationKey: string) {
  const query = normalizeAnalyticsSearchQuery(searchParams.get("q") ?? "");

  if (path !== "/search" || !query) {
    return;
  }

  const type = document.querySelector(".search-result-card") ? "SEARCH" : "SEARCH_ZERO";
  reportOnce({ path, query, type }, navigationKey);
}

function trackReadDepth(path: string) {
  const article = document.querySelector<HTMLElement>(".markdown-body");

  if (!article) {
    console.error("Analytics could not find .markdown-body for article read-depth tracking.");
    return;
  }

  let animationFrame = 0;
  const update = () => {
    animationFrame = 0;
    const articleTop = article.getBoundingClientRect().top + window.scrollY;
    const visibleArticleHeight = window.scrollY + window.innerHeight - articleTop;
    const progress = Math.max(0, Math.min(100, (visibleArticleHeight / article.scrollHeight) * 100));

    READ_DEPTHS.forEach((depth) => {
      if (progress >= Number(depth)) {
        reportOnce({ depth, path, type: "READ_DEPTH" });
      }
    });
  };
  const scheduleUpdate = () => {
    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(update);
    }
  };

  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  scheduleUpdate();

  return () => {
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("scroll", scheduleUpdate);
  };
}

export function normalizeAnalyticsSearchQuery(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalized.length <= SEARCH_QUERY_MAX ? normalized : "";
}

export function shouldSkipAnalyticsPath(path: string) {
  return EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function reportOnce(event: AnalyticsEvent, navigationKey = event.path) {
  const eventKey = createEventKey(event, navigationKey);

  if (!eventRegistry.claim(eventKey)) {
    return;
  }

  void recordEvent(event);
}

export function createAnalyticsEventRegistry() {
  let activeNavigationKey: string | null = null;
  const reportedEvents = new Set<string>();

  return {
    begin(navigationKey: string) {
      if (navigationKey === activeNavigationKey) {
        return;
      }

      activeNavigationKey = navigationKey;
      reportedEvents.clear();
    },
    claim(eventKey: string) {
      if (reportedEvents.has(eventKey)) {
        return false;
      }

      reportedEvents.add(eventKey);
      return true;
    },
  };
}

function createEventKey(event: AnalyticsEvent, navigationKey: string) {
  if (event.type === "READ_DEPTH") {
    return `${event.type}:${navigationKey}:${event.depth}`;
  }

  return `${event.type}:${navigationKey}`;
}

async function recordEvent(event: AnalyticsEvent) {
  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      body: JSON.stringify(event),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    });

    if (!response.ok) {
      console.error(`Analytics request failed with status ${response.status}.`);
    }
  } catch (error) {
    console.error("Analytics request failed.", error);
  }
}
