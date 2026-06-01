import { describe, expect, test } from "vitest";

import { moderateComment } from "./comment-moderation.ts";

const CLEAN_COMMENT = {
  body: "This is a thoughtful comment.",
  email: "reader@example.com",
  ip: "203.0.113.10",
  userAgent: "Playwright",
} as const;

describe("comment moderation", () => {
  test("keeps normal comments pending for human review", () => {
    const result = moderateComment(CLEAN_COMMENT);

    expect(result.status).toBe("PENDING");
    expect(result.spamScore).toBe(0);
    expect(result.ipHash).toHaveLength(64);
  });

  test("marks honeypot submissions as spam", () => {
    const result = moderateComment({ ...CLEAN_COMMENT, website: "https://spam.example" });

    expect(result.status).toBe("SPAM");
    expect(result.spamScore).toBeGreaterThanOrEqual(3);
  });

  test("marks repeated spam signals as spam", () => {
    const result = moderateComment({
      ...CLEAN_COMMENT,
      body: "casino loan https://a.example https://b.example https://c.example",
    });

    expect(result.status).toBe("SPAM");
    expect(result.spamScore).toBeGreaterThanOrEqual(3);
  });

  test("truncates long user agents", () => {
    const result = moderateComment({ ...CLEAN_COMMENT, userAgent: "x".repeat(600) });

    expect(result.userAgent).toHaveLength(500);
  });
});
