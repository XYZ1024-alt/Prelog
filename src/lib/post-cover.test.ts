import { afterEach, describe, expect, test } from "vitest";

import { createArticleGlyphRecipe, createArticleGlyphSignals } from "./glyph-recipe.ts";
import { resolvePostCover } from "./post-cover.ts";
import { createPostOgImageUrl, getSiteUrl } from "./site-url.ts";
import { postFormSchema } from "./validation.ts";

const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;
const RECIPE = createArticleGlyphRecipe({
  category: "engineering",
  labels: { category: "Engineering", tags: ["Next.js"] },
  postId: "post-1",
  signals: createArticleGlyphSignals("## Core\n\nText\n\n```ts\nconst ok = true;\n```"),
  tags: ["next-js"],
  title: "Deterministic cover",
});

afterEach(() => {
  process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL;
});

describe("post cover resolution", () => {
  test("resolves a locked Glyph recipe", () => {
    expect(
      resolvePostCover({
        coverImage: null,
        coverMode: "GLYPH",
        glyphRecipe: RECIPE,
        glyphSourceHash: RECIPE.sourceHash,
      }),
    ).toMatchObject({ mode: "GLYPH", sourceHash: RECIPE.sourceHash });
  });

  test("gives a manual HTTPS image precedence over a stored recipe", () => {
    expect(
      resolvePostCover({
        coverImage: "https://cdn.example.com/cover.png",
        coverMode: "MANUAL",
        glyphRecipe: RECIPE,
        glyphSourceHash: RECIPE.sourceHash,
      }),
    ).toEqual({ imageUrl: "https://cdn.example.com/cover.png", mode: "MANUAL" });
  });

  test("rejects mismatched Glyph recipe hashes", () => {
    expect(() =>
      resolvePostCover({
        coverImage: null,
        coverMode: "GLYPH",
        glyphRecipe: RECIPE,
        glyphSourceHash: "0000000000000000",
      }),
    ).toThrow("does not match");
  });

  test.each([
    "https://localhost/cover.png",
    "https://127.0.0.1/cover.png",
    "https://10.0.0.8/cover.png",
  ])("rejects a non-public manual image URL: %s", (coverImage) => {
    expect(() =>
      resolvePostCover({
        coverImage,
        coverMode: "MANUAL",
        glyphRecipe: RECIPE,
        glyphSourceHash: RECIPE.sourceHash,
      }),
    ).toThrow("public HTTPS URL");
  });
});

describe("post cover form validation", () => {
  test("requires an HTTPS URL in manual mode", () => {
    const result = postFormSchema.safeParse(createPostForm({ coverImage: "http://example.com/cover.png", coverMode: "MANUAL" }));

    expect(result.success).toBe(false);
  });

  test("allows Glyph mode without a manual URL", () => {
    expect(postFormSchema.safeParse(createPostForm({ coverImage: "", coverMode: "GLYPH" })).success).toBe(true);
  });
});

describe("public site URLs", () => {
  test("creates an absolute versioned OG image URL", () => {
    process.env.NEXTAUTH_URL = "https://prelog.example/base";

    expect(getSiteUrl().origin).toBe("https://prelog.example");
    expect(createPostOgImageUrl({ slug: "hello-world", sourceHash: RECIPE.sourceHash }).toString()).toBe(
      `https://prelog.example/api/og/posts/hello-world?v=${RECIPE.sourceHash}`,
    );
  });
});

function createPostForm(options: { readonly coverImage: string; readonly coverMode: "GLYPH" | "MANUAL" }) {
  return {
    categoryId: "",
    content: "## Body\n\nText",
    excerpt: "Excerpt",
    seoDescription: "",
    seoTitle: "",
    slug: "post",
    status: "DRAFT",
    tagNames: "",
    title: "Post",
    ...options,
  };
}
