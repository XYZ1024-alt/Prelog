import { GlyphHeroUpgrade } from "@/components/glyph-hero-upgrade";
import { createPrelogEngineRecipe, renderGlyphRecipe } from "@/lib/glyph-recipe";

const STATIC_RECIPE = createPrelogEngineRecipe();
const STATIC_GLYPH = renderGlyphRecipe(STATIC_RECIPE, "feature");

export function GlyphHero() {
  return (
    <div aria-hidden="true" className="glyph-hero">
      <pre className="glyph-hero__scene glyph-hero__scene--static">{STATIC_GLYPH}</pre>
      <GlyphHeroUpgrade recipe={STATIC_RECIPE} />
    </div>
  );
}
