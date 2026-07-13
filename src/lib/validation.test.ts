import { afterEach, describe, expect, test, vi } from "vitest";

import { analyticsSchema, commentSchema, isAllowedManualCoverUrl, publicHttpsUrlSchema } from "./validation.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public HTTPS URL validation", () => {
  test.each([
    "https://cdn.example.com/cover.webp",
    "https://8.8.8.8/cover.webp",
    "https://images.example.cn:8443/path/cover.png",
  ])("accepts public HTTPS URL %s", (value) => {
    expect(isAllowedManualCoverUrl(value)).toBe(true);
    expect(publicHttpsUrlSchema.safeParse(value).success).toBe(true);
  });

  test.each([
    "http://cdn.example.com/cover.webp",
    "https://user:password@cdn.example.com/cover.webp",
    "https://localhost/cover.webp",
    "https://assets.local/cover.webp",
    "https://internal/cover.webp",
    "https://127.0.0.1/cover.webp",
    "https://10.0.0.8/cover.webp",
    "https://169.254.10.2/cover.webp",
    "https://172.16.0.1/cover.webp",
    "https://192.168.1.5/cover.webp",
    "https://[::1]/cover.webp",
    "https://[::ffff:127.0.0.1]/cover.webp",
    "https://[fd00::1]/cover.webp",
    "https://[fe80::1]/cover.webp",
  ])("rejects non-public URL %s", (value) => {
    expect(isAllowedManualCoverUrl(value)).toBe(false);
    expect(publicHttpsUrlSchema.safeParse(value).success).toBe(false);
  });

  test("requires an exact configured host in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MANUAL_COVER_HOSTS", "cdn.example.com, images.example.cn");

    expect(isAllowedManualCoverUrl("https://cdn.example.com/cover.webp")).toBe(true);
    expect(isAllowedManualCoverUrl("https://other.example.com/cover.webp")).toBe(false);
  });

  test("rejects manual covers in production when no host allowlist is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MANUAL_COVER_HOSTS", "");

    expect(isAllowedManualCoverUrl("https://cdn.example.com/cover.webp")).toBe(false);
  });
});

describe("analytics validation", () => {
  test("accepts supported aggregate events", () => {
    expect(analyticsSchema.safeParse({ path: "/posts/hello", referrer: "https://example.com/a", type: "PAGE_VIEW" }).success).toBe(true);
    expect(analyticsSchema.safeParse({ depth: "90", path: "/posts/hello", type: "READ_DEPTH" }).success).toBe(true);
    const search = analyticsSchema.safeParse({ path: "/search", query: "  Missing   Topic  ", type: "SEARCH_ZERO" });

    expect(search.success).toBe(true);
    expect(search.data).toMatchObject({ query: "missing topic" });
  });

  test("rejects query strings and unsupported read-depth values", () => {
    expect(analyticsSchema.safeParse({ path: "/search?q=private", type: "SEARCH" }).success).toBe(false);
    expect(analyticsSchema.safeParse({ path: "/search", query: "x".repeat(81), type: "SEARCH" }).success).toBe(false);
    expect(analyticsSchema.safeParse({ depth: "100", path: "/posts/hello", type: "READ_DEPTH" }).success).toBe(false);
  });
});

describe("comment identifier validation", () => {
  test("rejects identifiers before they can expand a rate-limit key", () => {
    const result = commentSchema.safeParse({
      author: "Reader",
      body: "Comment",
      email: "reader@example.com",
      parentId: "",
      postId: "文".repeat(1_000),
      slug: "post",
      website: "",
    });

    expect(result.success).toBe(false);
  });
});
