import { afterEach, describe, expect, test, vi } from "vitest";

import {
  analyticsSchema,
  commentSchema,
  friendContactUrlSchema,
  friendLinkFormSchema,
  isPublicHttpsUrl,
  publicFriendUrlSchema,
} from "./validation.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("friend link validation", () => {
  test("normalizes public HTTPS URLs", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isPublicHttpsUrl("https://Friends.Example.com.:443/#directory")).toBe(true);
    expect(publicFriendUrlSchema.parse("https://Friends.Example.com.:443/#directory"))
      .toBe("https://friends.example.com/");
  });

  test.each([
    "http://friends.example.com/",
    "https://user:secret@friends.example.com/",
    "https://localhost/",
    "https://internal/",
    "https://10.0.0.3/",
    "https://[::1]/",
  ])("rejects non-public friend URL %s", (value) => {
    expect(publicFriendUrlSchema.safeParse(value).success).toBe(false);
  });

  test("validates the complete friend form and integer sort bounds", () => {
    const result = friendLinkFormSchema.safeParse({
      description: "Independent writing about the web.",
      isVisible: true,
      logoUrl: "",
      name: "Example Notes",
      sortOrder: "12",
      url: "https://example.com",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ logoUrl: undefined, sortOrder: 12, url: "https://example.com/" });
    expect(friendLinkFormSchema.safeParse({
      description: "Description",
      isVisible: true,
      logoUrl: "",
      name: "Example",
      sortOrder: "10000",
      url: "https://example.com",
    }).success).toBe(false);
  });
});

describe("friend contact URL validation", () => {
  test.each([
    ["/about", "/about"],
    ["mailto:hello@example.com", "mailto:hello@example.com"],
    ["https://contact.example.com#form", "https://contact.example.com/"],
  ])("accepts and normalizes %s", (value, expected) => {
    expect(friendContactUrlSchema.parse(value)).toBe(expected);
  });

  test.each([
    "//example.com/contact",
    "javascript:alert(1)",
    "http://contact.example.com",
    "mailto:not-an-email",
    "mailto:hello@example.com?subject=%0AInjected",
  ])("rejects unsafe contact URL %s", (value) => {
    expect(friendContactUrlSchema.safeParse(value).success).toBe(false);
  });
});

describe("public HTTPS URL validation", () => {
  test.each([
    "https://cdn.example.com/cover.webp",
    "https://8.8.8.8/cover.webp",
    "https://images.example.cn:8443/path/cover.png",
  ])("accepts public HTTPS URL %s", (value) => {
    expect(isPublicHttpsUrl(value)).toBe(true);
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
    expect(isPublicHttpsUrl(value)).toBe(false);
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
