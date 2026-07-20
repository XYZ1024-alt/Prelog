import { describe, expect, test } from "vitest";

import {
  createHeroAssemblySpec,
  getHeroAssemblyPosition,
  GLYPH_MOMENTUM_VELOCITY_THRESHOLD,
  hasGlyphMomentum,
  HERO_ASSEMBLY_PART_DURATION_MS,
  HERO_ASSEMBLY_STAGGER_MS,
  HERO_ASSEMBLY_TOTAL_MS,
  projectGlyphMomentumDegrees,
} from "./glyph-motion.ts";

const HERO_PARTS = [
  ["engine-p-r7-c1", [0, 0, -0.18]],
  ["engine-p-r6-c1", [0, 0, -0.18]],
  ["engine-p-r5-c1", [0, 0, -0.18]],
  ["engine-p-r4-c1", [0, -0.12, 0]],
  ["engine-p-r3-c1", [0, 0, -0.18]],
  ["engine-p-r2-c1", [0, 0, -0.18]],
  ["engine-p-r1-c1", [0, -0.12, 0]],
  ["engine-p-r3-c5", [0, -0.22, 0]],
  ["engine-p-r2-c5", [0, -0.22, 0]],
] as const;

describe("Hero Glyph assembly", () => {
  test("uses the fixed stem-to-bowl order and timing", () => {
    HERO_PARTS.forEach(([id, position], index) => {
      expect(createHeroAssemblySpec(id)).toEqual({
        delayMs: index * HERO_ASSEMBLY_STAGGER_MS,
        durationMs: HERO_ASSEMBLY_PART_DURATION_MS,
        position,
      });
    });
    expect(HERO_ASSEMBLY_TOTAL_MS).toBe(468);
  });

  test("settles every part without overshoot", () => {
    const spec = createHeroAssemblySpec("engine-p-r4-c1");

    expect(getHeroAssemblyPosition(spec, spec.delayMs - 1)).toEqual(spec.position);
    expect(getHeroAssemblyPosition(spec, spec.delayMs + spec.durationMs / 2)[1]).toBeCloseTo(-0.015);
    expect(getHeroAssemblyPosition(spec, spec.delayMs + spec.durationMs)).toEqual([0, 0, 0]);
  });

  test("rejects parts outside the Prelog P recipe", () => {
    expect(() => createHeroAssemblySpec("engine-p-unknown")).toThrowError(
      "Unsupported Prelog Hero assembly part: engine-p-unknown",
    );
  });
});

describe("Glyph release momentum", () => {
  test("uses the velocity magnitude threshold", () => {
    expect(hasGlyphMomentum(GLYPH_MOMENTUM_VELOCITY_THRESHOLD - 0.001, 0)).toBe(false);
    expect(hasGlyphMomentum(0.08, 0.08)).toBe(true);
  });

  test("projects pointer velocity into restrained rotation", () => {
    expect(projectGlyphMomentumDegrees(0.5)).toBeCloseTo(-12.375);
    expect(projectGlyphMomentumDegrees(-0.5)).toBeCloseTo(12.375);
    expect(projectGlyphMomentumDegrees(1)).toBe(-18);
    expect(projectGlyphMomentumDegrees(-1)).toBe(18);
  });
});
