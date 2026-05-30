"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { PUBLIC_ADMIN_PATH } from "@/lib/admin-path";

const ANALYTICS_ENDPOINT = "/api/analytics";
const EXCLUDED_PREFIXES = Array.from(new Set([PUBLIC_ADMIN_PATH, "/admin", "/api"]));

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const path = getPath(pathname, searchParams);

    if (!path || shouldSkipPath(path)) {
      return;
    }

    void recordPageView(path);
  }, [pathname, searchParams]);

  return null;
}

function getPath(pathname: string | null, searchParams: URLSearchParams) {
  if (!pathname) {
    return null;
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function shouldSkipPath(path: string) {
  return EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

async function recordPageView(path: string) {
  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      body: JSON.stringify({ path, referrer: document.referrer }),
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
