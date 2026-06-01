import { describe, expect, test } from "vitest";

import { createExcerpt, estimateReadingMinutes, plainTextFromMarkdown, toSlug } from "./text.ts";

describe("text helpers", () => {
  test("creates lowercase pinyin slugs for Chinese titles", () => {
    expect(toSlug("你好 Next.js 16")).toBe("ni-hao-next-js-16");
  });

  test("removes markdown punctuation from plain text", () => {
    expect(plainTextFromMarkdown("## Title\n\n**Bold** [Link](https://example.com)")).toBe("Title Bold Link https://example.com");
  });

  test("truncates long excerpts with an ellipsis", () => {
    const content = "a".repeat(200);

    expect(createExcerpt(content)).toHaveLength(183);
    expect(createExcerpt(content).endsWith("...")).toBe(true);
  });

  test("keeps reading time at one minute for short content", () => {
    expect(estimateReadingMinutes("Short content")).toBe(1);
  });
});
