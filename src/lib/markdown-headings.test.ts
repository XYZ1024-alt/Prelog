import { describe, expect, test } from "vitest";

import { cleanHeadingText, getMarkdownHeadings } from "./markdown-headings.ts";

describe("markdown headings", () => {
  test("extracts only h2 and h3 headings", () => {
    const headings = getMarkdownHeadings("# Ignored\n\n## Overview\n\n### Details\n\n#### Too deep");

    expect(headings).toEqual([
      { id: "overview", level: 2, text: "Overview" },
      { id: "details", level: 3, text: "Details" },
    ]);
  });

  test("cleans inline markdown before slugging", () => {
    expect(cleanHeadingText("**Bold** `Code` [Link]")).toBe("Bold Code Link");
  });

  test("creates unique ids for repeated headings", () => {
    const headings = getMarkdownHeadings("## Repeat\n\n## Repeat");

    expect(headings.map((heading) => heading.id)).toEqual(["repeat", "repeat-1"]);
  });
});
