import type { Vec3 } from "glyphcss";

export const HERO_ASSEMBLY_PART_DURATION_MS = 180;
export const HERO_ASSEMBLY_STAGGER_MS = 36;
export const GLYPH_MOMENTUM_DURATION_MS = 320;
export const GLYPH_MOMENTUM_HISTORY_MS = 80;
export const GLYPH_MOMENTUM_VELOCITY_THRESHOLD = 0.11;

const GLYPH_MOMENTUM_DECELERATION_RATE = 0.99;
const GLYPH_MOMENTUM_MAX_DEGREES = 18;
const GLYPH_POINTER_PIXELS_PER_DEGREE = 4;
const STEM_OFFSET: Vec3 = [0, 0, -0.18];
const HORIZONTAL_OFFSET: Vec3 = [0, -0.12, 0];
const BOWL_OFFSET: Vec3 = [0, -0.22, 0];

const HERO_ASSEMBLY_PARTS = [
  { id: "engine-p-r7-c1", position: STEM_OFFSET },
  { id: "engine-p-r6-c1", position: STEM_OFFSET },
  { id: "engine-p-r5-c1", position: STEM_OFFSET },
  { id: "engine-p-r4-c1", position: HORIZONTAL_OFFSET },
  { id: "engine-p-r3-c1", position: STEM_OFFSET },
  { id: "engine-p-r2-c1", position: STEM_OFFSET },
  { id: "engine-p-r1-c1", position: HORIZONTAL_OFFSET },
  { id: "engine-p-r3-c5", position: BOWL_OFFSET },
  { id: "engine-p-r2-c5", position: BOWL_OFFSET },
] as const;

export const HERO_ASSEMBLY_TOTAL_MS =
  HERO_ASSEMBLY_PART_DURATION_MS + (HERO_ASSEMBLY_PARTS.length - 1) * HERO_ASSEMBLY_STAGGER_MS;

export type HeroAssemblySpec = {
  readonly delayMs: number;
  readonly durationMs: number;
  readonly position: Vec3;
};

export function createHeroAssemblySpec(partId: string): HeroAssemblySpec {
  const index = HERO_ASSEMBLY_PARTS.findIndex(({ id }) => id === partId);

  if (index === -1) {
    throw new Error(`Unsupported Prelog Hero assembly part: ${partId}`);
  }

  return {
    delayMs: index * HERO_ASSEMBLY_STAGGER_MS,
    durationMs: HERO_ASSEMBLY_PART_DURATION_MS,
    position: [...HERO_ASSEMBLY_PARTS[index].position],
  };
}

export function getHeroAssemblyPosition(spec: HeroAssemblySpec, elapsedMs: number): Vec3 {
  const localProgress = clamp((elapsedMs - spec.delayMs) / spec.durationMs, 0, 1);
  if (localProgress === 1) return [0, 0, 0];
  const remaining = 1 - easeOutCubic(localProgress);
  return scaleVector(spec.position, remaining);
}

export function hasGlyphMomentum(velocityX: number, velocityY: number) {
  return Math.hypot(velocityX, velocityY) >= GLYPH_MOMENTUM_VELOCITY_THRESHOLD;
}

export function projectGlyphMomentumDegrees(velocityPxPerMs: number) {
  const projectedPixels = velocityPxPerMs
    * GLYPH_MOMENTUM_DECELERATION_RATE
    / (1 - GLYPH_MOMENTUM_DECELERATION_RATE);
  const degrees = -projectedPixels / GLYPH_POINTER_PIXELS_PER_DEGREE;
  return clamp(degrees, -GLYPH_MOMENTUM_MAX_DEGREES, GLYPH_MOMENTUM_MAX_DEGREES);
}

export function easeOutCubic(value: number) {
  return 1 - (1 - clamp(value, 0, 1)) ** 3;
}

function scaleVector(vector: Vec3, multiplier: number): Vec3 {
  return [vector[0] * multiplier, vector[1] * multiplier, vector[2] * multiplier];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
