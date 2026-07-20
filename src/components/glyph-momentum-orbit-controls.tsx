"use client";

import { useEffect, useRef } from "react";
import { useGlyphSceneContext } from "@glyphcss/react";
import { createGlyphOrbitControls, type GlyphSceneHandle } from "glyphcss";

import {
  easeOutCubic,
  GLYPH_MOMENTUM_DURATION_MS,
  GLYPH_MOMENTUM_HISTORY_MS,
  hasGlyphMomentum,
  projectGlyphMomentumDegrees,
} from "@/lib/glyph-motion";

type GlyphMomentumOrbitControlsProps = {
  readonly onInteractionStart?: () => void;
};

type PointerSample = {
  readonly time: number;
  readonly x: number;
  readonly y: number;
};

type MomentumState = {
  frameId: number | null;
  interacting: boolean;
};

const KEYBOARD_ROTATION_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Home",
]);

export function GlyphMomentumOrbitControls({ onInteractionStart }: GlyphMomentumOrbitControlsProps) {
  const { sceneRef } = useGlyphSceneContext();
  const onInteractionStartRef = useRef(onInteractionStart);

  useEffect(() => {
    onInteractionStartRef.current = onInteractionStart;
  }, [onInteractionStart]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) throw new Error("Interactive Glyph scene is unavailable.");

    const state: MomentumState = { frameId: null, interacting: false };
    let activePointerId: number | null = null;
    let samples: PointerSample[] = [];
    const controls = createGlyphOrbitControls(scene, { clampPitch: false, drag: true, wheel: false });

    const handlePointerDown = (event: PointerEvent) => {
      cancelMomentum(scene, state, false);
      activePointerId = event.pointerId;
      samples = [createSample(event)];
      onInteractionStartRef.current?.();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      samples = appendSample(samples, createSample(event));
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      const velocity = getReleaseVelocity(appendSample(samples, createSample(event)));
      activePointerId = null;
      samples = [];
      startMomentum(scene, state, velocity);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      samples = [];
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (KEYBOARD_ROTATION_KEYS.has(event.key)) cancelMomentum(scene, state);
    };

    scene.host.addEventListener("pointerdown", handlePointerDown, true);
    scene.host.addEventListener("pointermove", handlePointerMove);
    scene.host.addEventListener("pointerup", handlePointerUp);
    scene.host.addEventListener("pointercancel", handlePointerCancel);
    scene.host.addEventListener("keydown", handleKeyDown, true);
    return () => {
      scene.host.removeEventListener("pointerdown", handlePointerDown, true);
      scene.host.removeEventListener("pointermove", handlePointerMove);
      scene.host.removeEventListener("pointerup", handlePointerUp);
      scene.host.removeEventListener("pointercancel", handlePointerCancel);
      scene.host.removeEventListener("keydown", handleKeyDown, true);
      cancelMomentum(scene, state);
      controls.destroy();
    };
  }, [sceneRef]);

  return null;
}

function startMomentum(
  scene: GlyphSceneHandle,
  state: MomentumState,
  velocity: { readonly x: number; readonly y: number },
) {
  if (!hasGlyphMomentum(velocity.x, velocity.y)) return;
  const camera = scene.camera;
  const startRotation = { x: camera.rotX, y: camera.rotY };
  const targetRotation = {
    x: startRotation.x + projectGlyphMomentumDegrees(velocity.y),
    y: startRotation.y + projectGlyphMomentumDegrees(velocity.x),
  };
  const startedAt = performance.now();
  camera.mat = null;
  camera.useMat = false;
  state.interacting = true;
  scene.setInteracting(true);

  const animate = (timestamp: number) => {
    const progress = Math.min(1, (timestamp - startedAt) / GLYPH_MOMENTUM_DURATION_MS);
    const eased = easeOutCubic(progress);
    camera.rotX = interpolate(startRotation.x, targetRotation.x, eased);
    camera.rotY = interpolate(startRotation.y, targetRotation.y, eased);

    if (progress < 1) {
      scene.rerender();
      state.frameId = requestAnimationFrame(animate);
      return;
    }

    state.frameId = null;
    state.interacting = false;
    scene.setInteracting(false);
  };

  state.frameId = requestAnimationFrame(animate);
}

function cancelMomentum(
  scene: GlyphSceneHandle,
  state: MomentumState,
  restoreResolution = true,
) {
  if (state.frameId !== null) cancelAnimationFrame(state.frameId);
  state.frameId = null;
  if (state.interacting && restoreResolution) scene.setInteracting(false);
  state.interacting = false;
}

function appendSample(samples: readonly PointerSample[], sample: PointerSample) {
  const cutoff = sample.time - GLYPH_MOMENTUM_HISTORY_MS;
  return [...samples.filter(({ time }) => time >= cutoff), sample];
}

function getReleaseVelocity(samples: readonly PointerSample[]) {
  const first = samples[0];
  const last = samples.at(-1);
  const elapsed = last && first ? last.time - first.time : 0;

  if (!first || !last || elapsed <= 0) return { x: 0, y: 0 };
  return { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed };
}

function createSample(event: PointerEvent): PointerSample {
  return { time: event.timeStamp, x: event.clientX, y: event.clientY };
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
