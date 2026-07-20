import {
  getGlyphRecipeInitial,
  renderGlyphRecipe,
  type GlyphPreset,
  type GlyphRecipe,
} from "@/lib/glyph-recipe";

type ArticleGlyphProps = {
  readonly className?: string;
  readonly preset: GlyphPreset;
  readonly recipe: GlyphRecipe;
};

export function ArticleGlyph({ className, preset, recipe }: ArticleGlyphProps) {
  const classes = ["article-glyph", `article-glyph--${preset}`, className].filter(Boolean).join(" ");

  return (
    <pre
      aria-hidden="true"
      className={classes}
      data-glyph-hash={recipe.sourceHash}
      data-glyph-initial={getGlyphRecipeInitial(recipe) ?? undefined}
    >
      {renderGlyphRecipe(recipe, preset)}
    </pre>
  );
}
