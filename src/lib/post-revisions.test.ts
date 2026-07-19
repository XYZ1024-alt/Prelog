import { describe, expect, test } from "vitest";

import {
  createPostRevisionAuditJson,
  createPostRevisionSnapshot,
  parsePostRevisionSnapshot,
  postRevisionSnapshotSchema,
} from "./post-revisions.ts";

const SOURCE = {
  category: { id: "category-1", name: "工程", slug: "engineering" },
  content: "## 正文",
  excerpt: "摘要",
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

  test("captures invalid legacy state as an explicitly non-restorable audit snapshot", () => {
    const audit = createPostRevisionAuditJson({
      ...SOURCE,
      readingMinutes: 0,
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
      readingMinutes: 0,
      tags: [{ tag: tagWithDates }],
    }) as unknown as Record<string, unknown>;

    expect(audit.category).toEqual(SOURCE.category);
    expect(audit.tags).toEqual([SOURCE.tags[0].tag]);
  });
});
