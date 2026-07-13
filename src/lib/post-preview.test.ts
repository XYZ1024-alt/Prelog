import { describe, expect, test } from "vitest";

import {
  createPostPreviewToken,
  hashPostPreviewToken,
  resolvePostPreviewCover,
} from "./post-preview.ts";

describe("post preview", () => {
  test("creates a hash-only 24 hour preview credential", () => {
    const now = new Date("2026-07-13T08:00:00.000Z");
    const preview = createPostPreviewToken(now);

    expect(preview.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(preview.tokenHash).toBe(hashPostPreviewToken(preview.token));
    expect(preview.tokenHash).not.toContain(preview.token);
    expect(preview.expiresAt.toISOString()).toBe("2026-07-14T08:00:00.000Z");
  });

  test("generates a deterministic candidate cover for an unlocked draft", () => {
    const post = {
      category: null,
      content: "## 章节\n\n正文",
      coverImage: null,
      coverMode: "GLYPH" as const,
      glyphRecipe: null,
      glyphSourceHash: null,
      id: "draft-1",
      tags: [],
      title: "Draft",
    };

    expect(resolvePostPreviewCover(post)).toEqual(resolvePostPreviewCover(post));
  });
});
