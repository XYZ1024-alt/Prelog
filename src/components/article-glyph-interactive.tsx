"use client";

import { useEffect, useMemo, type RefObject } from "react";
import {
  GlyphCamera,
  GlyphMesh,
  GlyphScene,
  useGlyphCamera,
} from "@glyphcss/react";

import { GlyphMomentumOrbitControls } from "@/components/glyph-momentum-orbit-controls";
import { useGlyphReady } from "@/components/use-glyph-ready";
import {
  buildRuntimeGlyphPartPolygons,
  createRuntimeGlyphCellTransform,
  getRuntimeGlyphCamera,
  getRuntimeGlyphCellCharacters,
  getRuntimeGlyphInitial,
  getRuntimeGlyphRenderMode,
  type GlyphRuntimeRecipe,
} from "@/lib/glyph-runtime";

const KEYBOARD_ROTATION_STEP = 18;

export function ArticleGlyphInteractive({ recipe }: { readonly recipe: GlyphRuntimeRecipe }) {
  const { hostRef, ready } = useGlyphReady(".article-glyph-interactive__scene", recipe.sourceHash);
  const camera = useMemo(() => getRuntimeGlyphCamera(recipe, "feature"), [recipe]);
  const polygons = useMemo(() => recipe.parts.flatMap(buildRuntimeGlyphPartPolygons), [recipe]);
  const transformCells = useMemo(
    () => createRuntimeGlyphCellTransform(recipe.seed, getRuntimeGlyphCellCharacters(recipe)),
    [recipe],
  );

  return (
    <div
      aria-label={`可拖拽或使用方向键旋转的文章封面字形 ${getRuntimeGlyphInitial(recipe) ?? "旧版"}`}
      className="article-glyph-interactive"
      data-article-glyph-interactive="true"
      data-glyph-hash={recipe.sourceHash}
      data-glyph-ready={String(ready)}
      ref={hostRef}
      role="img"
      tabIndex={0}
    >
      <GlyphCamera
        center={camera.center}
        rotX={camera.rotX}
        rotY={camera.rotY}
        zoom={camera.zoom}
      >
        <GlyphScene
          autoSize
          className="article-glyph-interactive__scene"
          glyphPalette="solid"
          interactiveDownscale={2}
          mode={getRuntimeGlyphRenderMode(recipe)}
          transformCells={transformCells}
          useColors={false}
        >
          <GlyphMomentumOrbitControls />
          <GlyphKeyboardControls camera={camera} hostRef={hostRef} />
          <GlyphMesh polygons={polygons} />
        </GlyphScene>
      </GlyphCamera>
    </div>
  );
}

function GlyphKeyboardControls({
  camera: initialCamera,
  hostRef,
}: {
  readonly camera: ReturnType<typeof getRuntimeGlyphCamera>;
  readonly hostRef: RefObject<HTMLDivElement | null>;
}) {
  const { cameraRef, rerender } = useGlyphCamera();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) throw new Error("Interactive article Glyph host is unavailable.");

    const handleKeyDown = (event: KeyboardEvent) => {
      const camera = cameraRef.current;
      if (!camera || !applyKeyboardRotation(camera, event.key, initialCamera)) return;
      event.preventDefault();
      camera.mat = null;
      camera.useMat = false;
      rerender();
    };

    host.addEventListener("keydown", handleKeyDown);
    return () => host.removeEventListener("keydown", handleKeyDown);
  }, [cameraRef, hostRef, initialCamera, rerender]);

  return null;
}

function applyKeyboardRotation(
  camera: { rotX: number; rotY: number },
  key: string,
  initialCamera: ReturnType<typeof getRuntimeGlyphCamera>,
) {
  if (key === "ArrowLeft") camera.rotY -= KEYBOARD_ROTATION_STEP;
  else if (key === "ArrowRight") camera.rotY += KEYBOARD_ROTATION_STEP;
  else if (key === "ArrowUp") camera.rotX -= KEYBOARD_ROTATION_STEP;
  else if (key === "ArrowDown") camera.rotX += KEYBOARD_ROTATION_STEP;
  else if (key === "Home") {
    camera.rotX = initialCamera.rotX;
    camera.rotY = initialCamera.rotY;
  } else return false;
  return true;
}
