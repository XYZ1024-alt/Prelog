import { GlyphHeroUpgrade } from "@/components/glyph-hero-upgrade";
import { createPrelogEngineRecipe, renderGlyphRecipe } from "@/lib/glyph-recipe";

const STATIC_RECIPE = createPrelogEngineRecipe();
const STATIC_GLYPH = renderGlyphRecipe(STATIC_RECIPE, "feature");

export function GlyphHero({ postCount }: { readonly postCount: number }) {
  return (
    <div aria-hidden="true" className="glyph-hero">
      <div className="glyph-hero__axis glyph-hero__axis--horizontal" />
      <div className="glyph-hero__axis glyph-hero__axis--vertical" />
      <span className="glyph-hero__label glyph-hero__label--top">PRELOG / EDITING ENGINE</span>
      <span className="glyph-hero__label glyph-hero__label--bottom">
        POSTS / {String(postCount).padStart(2, "0")} · MODE / READ-WRITE
      </span>
      <pre className="glyph-hero__scene glyph-hero__scene--static">{STATIC_GLYPH}</pre>
      <GlyphHeroUpgrade recipe={STATIC_RECIPE} />
    </div>
  );
}
