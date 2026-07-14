"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { PUBLIC_ADMIN_PATH } from "@/lib/admin-path";

type AnalyticsEvent =
  | { readonly path: string; readonly referrer?: string; readonly type: "PAGE_VIEW" }
  | { readonly depth: "25" | "50" | "90"; readonly path: string; readonly type: "READ_DEPTH" }
  | { readonly path: string; readonly query: string; readonly type: "SEARCH" | "SEARCH_ZERO" };

const ANALYTICS_ENDPOINT = "/api/analytics";
const ARTICLE_CONTENT_SELECTOR = "h2, h3, p, pre, blockquote, figure, ul, ol, table";
const ARTICLE_SELECTOR = ".markdown-body";
const ARTICLE_WAIT_TIMEOUT_MS = 5_000;
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
  let stopObservingArticle: (() => void) | undefined;

  function startTracking() {
    const article = findVisibleArticle();

    if (!article) {
      return false;
    }

    stopObservingArticle = observeReadDepth(article, path);
    return true;
  }

  if (startTracking()) {
    return () => stopObservingArticle?.();
  }

  const streamObserver = new MutationObserver(() => {
    if (!startTracking()) return;
    streamObserver.disconnect();
    window.clearTimeout(timeoutId);
  });
  const timeoutId = window.setTimeout(() => {
    streamObserver.disconnect();
    console.error("Analytics could not find visible article content for read-depth tracking.");
  }, ARTICLE_WAIT_TIMEOUT_MS);
  streamObserver.observe(document.body, { childList: true, subtree: true });

  return () => {
    streamObserver.disconnect();
    window.clearTimeout(timeoutId);
    stopObservingArticle?.();
  };
}

function findVisibleArticle() {
  return Array.from(document.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR)).find((article) => (
    !article.closest("[hidden]") && article.querySelector(ARTICLE_CONTENT_SELECTOR)
  ));
}

function observeReadDepth(article: HTMLElement, path: string) {
  const contentElements = Array.from(article.querySelectorAll<HTMLElement>(ARTICLE_CONTENT_SELECTOR));
  const depthsByElement = createReadDepthTargets(article, contentElements, path);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const depths = depthsByElement.get(entry.target) ?? [];
      depths.forEach((depth) => reportOnce({ depth, path, type: "READ_DEPTH" }));
      observer.unobserve(entry.target);
    });
  });

  depthsByElement.forEach((_depths, element) => observer.observe(element));
  return () => observer.disconnect();
}

function createReadDepthTargets(
  article: HTMLElement,
  contentElements: readonly HTMLElement[],
  path: string,
) {
  const articleRect = article.getBoundingClientRect();
  const articleTop = articleRect.top + window.scrollY;
  const viewportBottom = window.scrollY + window.innerHeight;
  const depthsByElement = new Map<Element, (typeof READ_DEPTHS)[number][]>();

  READ_DEPTHS.forEach((depth) => {
    const thresholdOffset = article.scrollHeight * (Number(depth) / 100);

    if (viewportBottom >= articleTop + thresholdOffset) {
      reportOnce({ depth, path, type: "READ_DEPTH" });
    }

    const target = contentElements.find((element) => {
      const rect = element.getBoundingClientRect();
      const midpointOffset = rect.top - articleRect.top + rect.height / 2;
      return midpointOffset >= thresholdOffset;
    }) ?? contentElements.at(-1)!;

    const depths = depthsByElement.get(target) ?? [];
    depthsByElement.set(target, [...depths, depth]);
  });

  return depthsByElement;
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
