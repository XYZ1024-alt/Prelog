import { describe, expect, test } from "vitest";

import { createArticleGlyphRecipe, createArticleGlyphSignals } from "./glyph-recipe.ts";
import {
  createPostRevisionAuditJson,
  createPostRevisionSnapshot,
  parsePostRevisionSnapshot,
  postRevisionSnapshotSchema,
} from "./post-revisions.ts";

const RECIPE = createArticleGlyphRecipe({
  category: "engineering",
  labels: { category: "工程", tags: ["Next.js"] },
  postId: "post-1",
  signals: createArticleGlyphSignals("## 正文"),
  tags: ["next-js"],
  title: "文章",
});

const SOURCE = {
  category: { id: "category-1", name: "工程", slug: "engineering" },
  content: "## 正文",
  coverImage: null,
  coverMode: "GLYPH" as const,
  excerpt: "摘要",
  glyphGeneratedAt: new Date("2026-07-13T08:00:00.000Z"),
  glyphRecipe: RECIPE,
  glyphSourceHash: RECIPE.sourceHash,
  publishedAt: new Date("2026-07-12T08:00:00.000Z"),
  readingMinutes: 2,
  seoDescription: null,
  seoTitle: "SEO",
  slug: "post",
  status: "PUBLISHED" as const,
  tags: [{ tag: { id: "tag-1", name: "Next.js", slug: "next-js" } }],
  title: "文章",
};

describe("post revision snapshots", () => {
  test("serializes dates and taxonomy into immutable JSON data", () => {
    const snapshot = createPostRevisionSnapshot(SOURCE);

    expect(snapshot).toMatchObject({
      glyphGeneratedAt: "2026-07-13T08:00:00.000Z",
      publishedAt: "2026-07-12T08:00:00.000Z",
      tags: [{ slug: "next-js" }],
      version: 1,
    });
  });

  test("rejects malformed snapshots before restore", () => {
    expect(() => parsePostRevisionSnapshot({ ...createPostRevisionSnapshot(SOURCE), readingMinutes: 0 }))
      .toThrow();
  });

  test("rejects published snapshots without a publication date", () => {
    expect(() => parsePostRevisionSnapshot({
      ...createPostRevisionSnapshot(SOURCE),
      publishedAt: null,
    })).toThrow(/publication date/i);
  });

  test("rejects manual covers that are not public HTTPS URLs", () => {
    expect(() => parsePostRevisionSnapshot({
      ...createPostRevisionSnapshot(SOURCE),
      coverImage: "https://localhost/private.png",
      coverMode: "MANUAL",
    })).toThrow(/public HTTPS/i);
  });

  test("rejects published Glyph snapshots whose recipe hash does not match", () => {
    expect(() => parsePostRevisionSnapshot({
      ...createPostRevisionSnapshot(SOURCE),
      glyphSourceHash: "0000000000000000",
    })).toThrow(/do not match/i);
  });

  test("captures invalid legacy state as an explicitly non-restorable audit snapshot", () => {
    const audit = createPostRevisionAuditJson({
      ...SOURCE,
      glyphSourceHash: "0000000000000000",
    }) as Record<string, unknown>;

    expect(postRevisionSnapshotSchema.safeParse(audit).success).toBe(false);
    expect(audit.audit).toMatchObject({ capturedInvalid: true });
  });

  test("projects relation fields before writing an invalid audit snapshot", () => {
    const categoryWithDates = { ...SOURCE.category, createdAt: new Date() };
    const tagWithDates = { ...SOURCE.tags[0].tag, updatedAt: new Date() };
    const audit = createPostRevisionAuditJson({
      ...SOURCE,
      category: categoryWithDates,
      glyphSourceHash: "0000000000000000",
      tags: [{ tag: tagWithDates }],
    }) as unknown as Record<string, unknown>;

    expect(audit.category).toEqual(SOURCE.category);
    expect(audit.tags).toEqual([SOURCE.tags[0].tag]);
  });
});
