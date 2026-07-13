"use client";

import { createElement, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";

import type { GlyphRuntimeRecipe } from "@/lib/glyph-runtime";

const INTERACTIVE_ARTICLE_QUERY = "(min-width: 820px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

type InteractiveArticleGlyph = ComponentType<{ readonly recipe: GlyphRuntimeRecipe }>;

export function ArticleGlyphUpgrade({ recipe }: { readonly recipe: GlyphRuntimeRecipe }) {
  const interactive = useSyncExternalStore(
    subscribeToInteractivePreference,
    getInteractivePreference,
    getServerInteractivePreference,
  );

  return interactive ? <InteractiveArticleGlyphLoader recipe={recipe} /> : null;
}

function InteractiveArticleGlyphLoader({ recipe }: { readonly recipe: GlyphRuntimeRecipe }) {
  const [component, setComponent] = useState<InteractiveArticleGlyph | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let disposed = false;

    void import("@/components/article-glyph-interactive")
      .then(({ ArticleGlyphInteractive }) => {
        if (!disposed) {
          setComponent(() => ArticleGlyphInteractive);
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

  return component ? createElement(component, { key: recipe.sourceHash, recipe }) : null;
}

function subscribeToInteractivePreference(onStoreChange: () => void) {
  const query = window.matchMedia(INTERACTIVE_ARTICLE_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getInteractivePreference() {
  return window.matchMedia(INTERACTIVE_ARTICLE_QUERY).matches;
}

function getServerInteractivePreference() {
  return false;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(`Failed to load the interactive article Glyph: ${String(error)}`);
}
