import { describe, expect, test } from "vitest";

import {
  createAnalyticsEventRegistry,
  normalizeAnalyticsSearchQuery,
  shouldSkipAnalyticsPath,
} from "./analytics-tracker.tsx";

describe("analytics path exclusions", () => {
  test.each([
    "/preview",
    "/preview/bearer-token-value",
    "/api/preview/bearer-token-value",
    "/admin/posts",
  ])("does not report private path %s", (path) => {
    expect(shouldSkipAnalyticsPath(path)).toBe(true);
  });

  test("reports public article paths", () => {
    expect(shouldSkipAnalyticsPath("/posts/public-article")).toBe(false);
  });
});

describe("analytics navigation event registry", () => {
  test("deduplicates one navigation but counts a later revisit", () => {
    const registry = createAnalyticsEventRegistry();

    registry.begin("/posts/a");
    expect(registry.claim("PAGE_VIEW:/posts/a")).toBe(true);
    expect(registry.claim("PAGE_VIEW:/posts/a")).toBe(false);
    registry.begin("/posts/b");
    expect(registry.claim("PAGE_VIEW:/posts/b")).toBe(true);
    registry.begin("/posts/a");
    expect(registry.claim("PAGE_VIEW:/posts/a")).toBe(true);
  });

  test("resets a public navigation after an excluded route without retaining its token", () => {
    const registry = createAnalyticsEventRegistry();

    registry.begin("/posts/a");
    expect(registry.claim("PAGE_VIEW:/posts/a")).toBe(true);
    registry.begin("excluded-navigation");
    registry.begin("/posts/a");
    expect(registry.claim("PAGE_VIEW:/posts/a")).toBe(true);
  });

  test("rejects an overlong search query instead of truncating and reporting it", () => {
    expect(normalizeAnalyticsSearchQuery("x".repeat(81))).toBe("");
  });
});
