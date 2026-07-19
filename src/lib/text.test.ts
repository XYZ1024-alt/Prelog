import { describe, expect, test } from "vitest";

import {
  createArticleDescription,
  createExcerpt,
  estimateReadingMinutes,
  plainTextFromMarkdown,
  stripLeadingTitleHeading,
  toSlug,
} from "./text.ts";

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

  test("removes a matching title heading before truncating an excerpt", () => {
    const title = "t".repeat(120);
    const body = "b".repeat(200);

    expect(createExcerpt(`# ${title}\n\n${body}`, title)).toBe(`${"b".repeat(180)}...`);
  });

  test("removes a repeated article title from a generated description", () => {
    expect(
      createArticleDescription({
        excerpt: "把 Pretext 放进博客阅读体验 Pretext 不是 Markdown 渲染器。",
        title: "把 Pretext 放进博客阅读体验",
      }),
    ).toBe("Pretext 不是 Markdown 渲染器。");
  });

  test("keeps descriptions whose opening only partially matches the title", () => {
    expect(createArticleDescription({ excerpt: "Aided design notes", title: "AI" })).toBe("Aided design notes");
  });

  test("keeps a leading heading that does not match the article title", () => {
    expect(stripLeadingTitleHeading("# A different heading\n\nBody", "Article title")).toBe(
      "# A different heading\n\nBody",
    );
  });

  test("keeps reading time at one minute for short content", () => {
    expect(estimateReadingMinutes("Short content")).toBe(1);
  });
});
