import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import {
  createArticleGlyphRecipe,
  createArticleGlyphSignals,
  glyphRecipeSchema,
} from "@/lib/glyph-recipe";
import { resolvePostCover, type ResolvedPostCover } from "@/lib/post-cover";

const PREVIEW_TOKEN_BYTES = 32;
const PREVIEW_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const previewTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

type PreviewPostSource = {
  readonly category: { readonly name: string; readonly slug: string } | null;
  readonly content: string;
  readonly coverImage: string | null;
  readonly coverMode: "GLYPH" | "MANUAL";
  readonly glyphRecipe: unknown;
  readonly glyphSourceHash: string | null;
  readonly id: string;
  readonly tags: readonly { readonly tag: { readonly name: string; readonly slug: string } }[];
  readonly title: string;
};

export function createPostPreviewToken(now = new Date()) {
  const token = randomBytes(PREVIEW_TOKEN_BYTES).toString("base64url");
  return {
    expiresAt: new Date(now.getTime() + PREVIEW_TOKEN_TTL_MS),
    token,
    tokenHash: hashPostPreviewToken(token),
  };
}

export function hashPostPreviewToken(value: string) {
  const token = previewTokenSchema.parse(value);
  return createHash("sha256").update(token).digest("hex");
}

export function resolvePostPreviewCover(post: PreviewPostSource): ResolvedPostCover {
  if (post.coverMode === "MANUAL") return resolvePostCover(post);
  const lockedRecipe = glyphRecipeSchema.safeParse(post.glyphRecipe);

  if (lockedRecipe.success && lockedRecipe.data.sourceHash === post.glyphSourceHash) {
    return resolvePostCover(post);
  }

  const recipe = createArticleGlyphRecipe({
    category: post.category?.slug ?? null,
    labels: {
      category: post.category?.name ?? null,
      tags: post.tags.map(({ tag }) => tag.name),
    },
    postId: post.id,
    signals: createArticleGlyphSignals(post.content),
    tags: post.tags.map(({ tag }) => tag.slug).sort(),
    title: post.title,
  });

  return { mode: "GLYPH", recipe, sourceHash: recipe.sourceHash };
}
