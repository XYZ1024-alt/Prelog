import { describe, expect, it } from "vitest";

import { getHeadingProgress } from "@/components/article-toc";
import type { MarkdownHeading } from "@/lib/markdown-headings";

const HEADINGS: readonly MarkdownHeading[] = [
  { id: "start", level: 2, text: "Start" },
  { id: "middle", level: 2, text: "Middle" },
  { id: "finish", level: 2, text: "Finish" },
];

describe("getHeadingProgress", () => {
  it("maps the active heading to stable section progress", () => {
    expect(getHeadingProgress(HEADINGS, "start")).toBe(0);
    expect(getHeadingProgress(HEADINGS, "middle")).toBe(50);
    expect(getHeadingProgress(HEADINGS, "finish")).toBe(100);
  });

  it("keeps unknown and single headings at the start", () => {
    expect(getHeadingProgress(HEADINGS, "missing")).toBe(0);
    expect(getHeadingProgress(HEADINGS.slice(0, 1), "start")).toBe(0);
  });
});
