import { glyphRecipeSchema, type GlyphRecipe } from "@/lib/glyph-recipe";
import { publicHttpsUrlSchema } from "@/lib/validation";

type PostCoverSource = {
  readonly coverImage: string | null;
  readonly coverMode: "GLYPH" | "MANUAL";
  readonly glyphRecipe: unknown;
  readonly glyphSourceHash: string | null;
};

export type ResolvedPostCover =
  | { readonly imageUrl: string; readonly mode: "MANUAL" }
  | { readonly mode: "GLYPH"; readonly recipe: GlyphRecipe; readonly sourceHash: string };

export function resolvePostCover(post: PostCoverSource): ResolvedPostCover {
  if (post.coverMode === "MANUAL") {
    return { imageUrl: parseManualCoverUrl(post.coverImage), mode: "MANUAL" };
  }

  const recipe = glyphRecipeSchema.parse(post.glyphRecipe);

  if (!post.glyphSourceHash || post.glyphSourceHash !== recipe.sourceHash) {
    throw new Error("Published GLYPH cover hash does not match its locked recipe.");
  }

  return { mode: "GLYPH", recipe, sourceHash: post.glyphSourceHash };
}

function parseManualCoverUrl(value: string | null) {
  if (!value) {
    throw new Error("Published MANUAL cover is missing its image URL.");
  }

  const parsed = publicHttpsUrlSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("Published MANUAL cover image must be a public HTTPS URL.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
