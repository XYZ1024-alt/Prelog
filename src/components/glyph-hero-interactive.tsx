"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import {
  GlyphCamera,
  GlyphScene,
  useGlyphSceneContext,
} from "@glyphcss/react";
import type { GlyphMeshHandle, Polygon } from "glyphcss";

import { GlyphMomentumOrbitControls } from "@/components/glyph-momentum-orbit-controls";
import { useGlyphReady } from "@/components/use-glyph-ready";
import {
  createHeroAssemblySpec,
  getHeroAssemblyPosition,
  HERO_ASSEMBLY_TOTAL_MS,
  type HeroAssemblySpec,
} from "@/lib/glyph-motion";
import {
  buildRuntimeGlyphPartPolygons,
  createRuntimeGlyphCellTransform,
  getRuntimeGlyphCamera,
  getRuntimeGlyphCellCharacters,
  getRuntimeGlyphRenderMode,
  type GlyphRuntimeRecipe,
} from "@/lib/glyph-runtime";

type AssemblyPart = {
  readonly polygons: Polygon[];
  readonly spec: HeroAssemblySpec;
};

export function GlyphHeroInteractive({ recipe }: { readonly recipe: GlyphRuntimeRecipe }) {
  const { hostRef, ready } = useGlyphReady(".glyph-hero__scene--interactive", recipe.sourceHash);
  const finishAssemblyRef = useRef<() => void>(() => undefined);
  const camera = useMemo(() => getRuntimeGlyphCamera(recipe, "feature"), [recipe]);
  const cellTransform = useMemo(
    () => createRuntimeGlyphCellTransform(recipe.seed, getRuntimeGlyphCellCharacters(recipe)),
    [recipe],
  );
  const parts = useMemo(() => recipe.parts.map((part) => ({
    polygons: buildRuntimeGlyphPartPolygons(part),
    spec: createHeroAssemblySpec(part.id),
  })), [recipe]);

  return (
    <div
      className="glyph-hero__interactive-layer"
      data-assembled="false"
      data-glyph-hero-interactive="true"
      data-glyph-ready={String(ready)}
      ref={hostRef}
    >
      <GlyphCamera
        center={camera.center}
        rotX={camera.rotX}
        rotY={camera.rotY}
        zoom={camera.zoom}
      >
        <GlyphScene
          autoSize
          className="glyph-hero__scene glyph-hero__scene--interactive"
          glyphPalette="solid"
          interactiveDownscale={2}
          mode={getRuntimeGlyphRenderMode(recipe)}
          transformCells={cellTransform}
          useColors={false}
        >
          <GlyphMomentumOrbitControls onInteractionStart={() => finishAssemblyRef.current()} />
          <GlyphHeroAssembly
            finishRef={finishAssemblyRef}
            hostRef={hostRef}
            parts={parts}
          />
        </GlyphScene>
      </GlyphCamera>
      <span aria-hidden="true" className="glyph-hero__cursor" />
    </div>
  );
}

function GlyphHeroAssembly({
  finishRef,
  hostRef,
  parts,
}: {
  readonly finishRef: MutableRefObject<() => void>;
  readonly hostRef: RefObject<HTMLDivElement | null>;
  readonly parts: readonly AssemblyPart[];
}) {
  const { sceneRef } = useGlyphSceneContext();

  useEffect(() => {
    const scene = sceneRef.current;
    const host = hostRef.current;
    if (!scene || !host) throw new Error("Prelog Hero assembly scene is unavailable.");

    const handles = parts.map((part) => scene.add(part.polygons, { position: part.spec.position }));
    let frameId: number | null = null;
    let startedAt: number | null = null;
    let finished = false;
    scene.setInteracting(true);

    const finish = () => {
      if (finished) return;
      finished = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      handles.forEach((handle) => handle.setTransform({ position: [0, 0, 0] }));
      host.dataset.assembled = "true";
      scene.setInteracting(false);
    };
    finishRef.current = finish;

    const animate = (timestamp: number) => {
      startedAt ??= timestamp;
      const elapsedMs = timestamp - startedAt;
      updateAssemblyHandles(handles, parts, elapsedMs);
      if (elapsedMs >= HERO_ASSEMBLY_TOTAL_MS) return finish();
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      finishRef.current = () => undefined;
      if (!finished) scene.setInteracting(false);
      handles.forEach((handle) => handle.dispose());
    };
  }, [finishRef, hostRef, parts, sceneRef]);

  return null;
}

function updateAssemblyHandles(
  handles: readonly GlyphMeshHandle[],
  parts: readonly AssemblyPart[],
  elapsedMs: number,
) {
  handles.forEach((handle, index) => {
    handle.setTransform({ position: getHeroAssemblyPosition(parts[index].spec, elapsedMs) });
  });
}
