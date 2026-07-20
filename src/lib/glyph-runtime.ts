import {
  cubePolygons,
  ringPolygons,
  type Polygon,
  type TransformCells,
  type Vec3,
} from "glyphcss";

const FRAME_BAR_THICKNESS = 0.12;
const FRAME_BAR_OFFSET = 0.44;
const RING_SEGMENTS = 20;
const HASH_32_OFFSET = 0x811c9dc5;
const HASH_32_PRIME = 0x01000193;
const CELL_ROW_FACTOR = 0x9e3779b1;
const CELL_COLUMN_FACTOR = 0x85ebca6b;
const CELL_MIX_FACTOR_A = 0x7feb352d;
const CELL_MIX_FACTOR_B = 0x846ca68b;
const DEFAULT_CELL_CHARACTERS = [".", ":", "+", "*", "#", "@"] as const;
const LEGACY_RECIPE_VERSION = 1;

const RUNTIME_ZOOM_MULTIPLIER = {
  feature: 1,
  social: 1,
  thumbnail: 1,
} as const;

export type GlyphRuntimePreset = keyof typeof RUNTIME_ZOOM_MULTIPLIER;

export type GlyphRuntimePart = {
  readonly color: string;
  readonly id: string;
  readonly kind: "box" | "ring" | "frame";
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
};

type GlyphRuntimeRecipeCore = {
  readonly camera: {
    readonly center: [number, number];
    readonly rotX: number;
    readonly rotY: number;
    readonly zoom: number;
  };
  readonly parts: readonly GlyphRuntimePart[];
  readonly seed: string;
  readonly sourceHash: string;
};

export type GlyphRuntimeRecipe = GlyphRuntimeRecipeCore & ({
  readonly labels: {
    readonly category: string | null;
    readonly tags: readonly string[];
    readonly title: string;
  };
  readonly version: 1;
} | {
  readonly labels: {
    readonly category: string | null;
    readonly initial: string;
    readonly tags: readonly string[];
    readonly title: string;
  };
  readonly style: {
    readonly cellPalette: "initial" | "prelog";
    readonly renderMode: "solid" | "wireframe";
  };
  readonly version: 2 | 3;
});

type Transform = {
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
};

export function getRuntimeGlyphCamera(recipe: GlyphRuntimeRecipe, preset: GlyphRuntimePreset) {
  return {
    center: recipe.camera.center,
    rotX: recipe.camera.rotX,
    rotY: recipe.camera.rotY,
    zoom: recipe.camera.zoom * RUNTIME_ZOOM_MULTIPLIER[preset],
  };
}

export function getRuntimeGlyphInitial(recipe: GlyphRuntimeRecipe) {
  return recipe.version === LEGACY_RECIPE_VERSION ? null : recipe.labels.initial;
}

export function getRuntimeGlyphRenderMode(recipe: GlyphRuntimeRecipe) {
  return recipe.version === LEGACY_RECIPE_VERSION ? "wireframe" : recipe.style.renderMode;
}

export function getRuntimeGlyphCellCharacters(recipe: GlyphRuntimeRecipe) {
  const initial = getRuntimeGlyphInitial(recipe);
  return recipe.version !== LEGACY_RECIPE_VERSION && recipe.style.cellPalette === "initial" && initial
    ? [initial]
    : DEFAULT_CELL_CHARACTERS;
}

export function createRuntimeGlyphCellTransform(
  seed: string,
  characters: readonly string[] = DEFAULT_CELL_CHARACTERS,
): TransformCells {
  if (!seed) {
    throw new Error("Glyph cell seed must not be empty.");
  }

  const seedHash = hash32(seed);
  const palette = [...characters];
  validateCellCharacters(palette);

  return (grid) => {
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.cols; column += 1) {
        const index = row * grid.cols + column;
        if (grid.char[index] !== " ") {
          grid.char[index] = palette[mixCellHash(seedHash, row, column) % palette.length];
        }
      }
    }
  };
}

export function buildRuntimeGlyphPartPolygons(part: GlyphRuntimePart): Polygon[] {
  return applyTransform(createBasePartPolygons(part), {
    position: part.position,
    rotation: part.rotation,
    scale: part.scale,
  });
}

function validateCellCharacters(characters: readonly string[]) {
  if (characters.length === 0 || characters.some((character) => Array.from(character).length !== 1)) {
    throw new Error("Glyph cell characters must contain at least one single character.");
  }
}

function createBasePartPolygons(part: GlyphRuntimePart) {
  if (part.kind === "ring") {
    return ringPolygons({
      axis: 2,
      color: part.color,
      halfThickness: 0.08,
      radius: 0.5,
      segments: RING_SEGMENTS,
    });
  }
  if (part.kind === "frame") {
    return createFramePolygons(part.color);
  }
  return cubePolygons({ center: [0, 0, 0], color: part.color, size: 1 });
}

function createFramePolygons(color: string) {
  const cube = cubePolygons({ center: [0, 0, 0], color, size: 1 });
  const bars: Transform[] = [
    { position: [0, FRAME_BAR_OFFSET, 0], rotation: [0, 0, 0], scale: [1, FRAME_BAR_THICKNESS, FRAME_BAR_THICKNESS] },
    { position: [0, -FRAME_BAR_OFFSET, 0], rotation: [0, 0, 0], scale: [1, FRAME_BAR_THICKNESS, FRAME_BAR_THICKNESS] },
    { position: [-FRAME_BAR_OFFSET, 0, 0], rotation: [0, 0, 0], scale: [FRAME_BAR_THICKNESS, 0.76, FRAME_BAR_THICKNESS] },
    { position: [FRAME_BAR_OFFSET, 0, 0], rotation: [0, 0, 0], scale: [FRAME_BAR_THICKNESS, 0.76, FRAME_BAR_THICKNESS] },
  ];
  return bars.flatMap((transform) => applyTransform(cube, transform));
}

function applyTransform(polygons: readonly Polygon[], transform: Transform): Polygon[] {
  return polygons.map((polygon) => ({
    ...polygon,
    vertices: polygon.vertices.map((vertex) => transformPoint(vertex, transform)),
  }));
}

function transformPoint(vertex: Vec3, transform: Transform): Vec3 {
  let x = vertex[0] * transform.scale[0];
  let y = vertex[1] * transform.scale[1];
  let z = vertex[2] * transform.scale[2];
  const [sinX, cosX] = sineCosine(transform.rotation[0]);
  const [sinY, cosY] = sineCosine(transform.rotation[1]);
  const [sinZ, cosZ] = sineCosine(transform.rotation[2]);
  [x, y] = [cosZ * x - sinZ * y, sinZ * x + cosZ * y];
  [x, z] = [cosY * x + sinY * z, -sinY * x + cosY * z];
  [y, z] = [cosX * y - sinX * z, sinX * y + cosX * z];
  return [x + transform.position[0], y + transform.position[1], z + transform.position[2]];
}

function sineCosine(degrees: number) {
  const radians = degrees * Math.PI / 180;
  return [Math.sin(radians), Math.cos(radians)] as const;
}

function hash32(value: string) {
  let hash = HASH_32_OFFSET;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, HASH_32_PRIME);
  }
  return hash >>> 0;
}

function mixCellHash(seedHash: number, row: number, column: number) {
  let value = seedHash ^ Math.imul(row + 1, CELL_ROW_FACTOR) ^ Math.imul(column + 1, CELL_COLUMN_FACTOR);
  value = Math.imul(value ^ value >>> 16, CELL_MIX_FACTOR_A);
  value = Math.imul(value ^ value >>> 15, CELL_MIX_FACTOR_B);
  return (value ^ value >>> 16) >>> 0;
}
