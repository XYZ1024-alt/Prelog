"use client";

import { createElement, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";

import type { GlyphRuntimeRecipe } from "@/lib/glyph-runtime";

const INTERACTIVE_HERO_QUERY = "(min-width: 820px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

type InteractiveGlyphHero = ComponentType<{ readonly recipe: GlyphRuntimeRecipe }>;

export function GlyphHeroUpgrade({ recipe }: { readonly recipe: GlyphRuntimeRecipe }) {
  const interactive = useSyncExternalStore(
    subscribeToInteractivePreference,
    getInteractivePreference,
    getServerInteractivePreference,
  );

  if (!interactive) {
    return null;
  }

  return <InteractiveHeroLoader recipe={recipe} />;
}

function InteractiveHeroLoader({ recipe }: { readonly recipe: GlyphRuntimeRecipe }) {
  const [component, setComponent] = useState<InteractiveGlyphHero | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let disposed = false;

    void import("@/components/glyph-hero-interactive")
      .then(({ GlyphHeroInteractive }) => {
        if (!disposed) {
          setComponent(() => GlyphHeroInteractive);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setLoadError(toError(error));
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  if (loadError) {
    throw loadError;
  }

  return component ? createElement(component, { recipe }) : null;
}

function subscribeToInteractivePreference(onStoreChange: () => void) {
  const query = window.matchMedia(INTERACTIVE_HERO_QUERY);
  query.addEventListener("change", onStoreChange);

  return () => {
    query.removeEventListener("change", onStoreChange);
  };
}

function getInteractivePreference() {
  return window.matchMedia(INTERACTIVE_HERO_QUERY).matches;
}

function getServerInteractivePreference() {
  return false;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(`Failed to load the interactive glyph hero: ${String(error)}`);
}
