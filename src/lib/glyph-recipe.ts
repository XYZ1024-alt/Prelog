import type { Root, RootContent } from "mdast";
import { z } from "zod";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import {
  buildRasterizeContext,
  createGlyphOrthographicCamera,
  rasterize,
  type Polygon,
  type Vec3,
} from "glyphcss";

import {
  getTitleGlyphPattern,
  TITLE_GLYPH_COLUMNS,
  TITLE_GLYPH_ROWS,
} from "@/lib/glyph-initial-font";
import {
  buildRuntimeGlyphPartPolygons,
  createRuntimeGlyphCellTransform,
  getRuntimeGlyphCamera,
  getRuntimeGlyphCellCharacters,
  getRuntimeGlyphRenderMode,
} from "@/lib/glyph-runtime";
import { createTitleInitial } from "@/lib/text";

const MAX_SECTIONS = 8;
const MAX_RECIPE_PARTS = 96;
const FALLBACK_SECTION_TITLE = "正文";
const DEFAULT_PART_COLOR = "#ffffff";
const HASH_64_OFFSET = 0xcbf29ce484222325n;
const HASH_64_PRIME = 0x100000001b3n;
const CELL_CHARACTERS = [".", ":", "+", "*", "#", "@"] as const;
const LEGACY_GLYPH_RECIPE_VERSION = 1;
const INITIAL_GLYPH_RECIPE_VERSION = 2;
const GLYPH_RECIPE_VERSION = 3;
const GLYPH_CELL_ASPECT = 2;
const ARTICLE_FIT_COLUMNS = 80;
const ARTICLE_FIT_ROWS = 40;
const ARTICLE_FIT_WIDTH = 60;
const ARTICLE_FIT_HEIGHT = 28;
const ARTICLE_INITIAL_ROT_X = 90;
const INITIAL_CELL_DEPTH = 0.42;
const INITIAL_CELL_HEIGHT = 1.05;
const INITIAL_RUN_INSET = 0.15;
const TITLE_INITIAL_STYLE = "title-initial-structure-v1";
const ARTICLE_CAMERA_ROT_Y = -8;
const SECTION_DEPTH_BASE = 0.08;
const SECTION_DEPTH_RANGE = 0.34;
const SECTION_DIVIDER_INSET = 0.08;
const H3_DIVIDER_INSET = 0.018;
const MAX_H3_DIVIDER_INSET = 0.07;
const MAX_CODE_PARTS = 3;
const MAX_QUOTE_PARTS = 2;
const MAX_LIST_PARTS = 3;
const MAX_IMAGE_PARTS = 2;
const FEATURE_COUNT_SCALE_LIMIT = 8;
const FEATURE_OVERLAP = 0.08;
const FEATURE_DEPTH = 0.34;
const FEATURE_VERTICAL_MARGIN = 0.55;

const vectorSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);

const positiveVectorSchema = z.tuple([
  z.number().finite().positive().max(20),
  z.number().finite().positive().max(20),
  z.number().finite().positive().max(20),
]);

const glyphPartSchema = z.object({
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  id: z.string().min(1).max(96).regex(/^[a-z0-9-]+$/),
  kind: z.enum(["box", "ring", "frame"]),
  position: vectorSchema,
  rotation: vectorSchema,
  scale: positiveVectorSchema,
}).strict();

const legendSchema = z.object({
  codeBlocks: z.number().int().nonnegative(),
  images: z.number().int().nonnegative(),
  lists: z.number().int().nonnegative(),
  quotes: z.number().int().nonnegative(),
  sections: z.number().int().min(1).max(MAX_SECTIONS),
}).strict();

const glyphLabelsV1Schema = z.object({
  category: z.string().min(1).max(256).nullable(),
  tags: z.array(z.string().min(1).max(128)).max(64),
  title: z.string().min(1).max(1000),
}).strict();

const glyphLabelsV2Schema = glyphLabelsV1Schema.extend({
  initial: z.string().regex(/^[A-Z0-9]$/),
}).strict();

const glyphRecipeCoreSchema = z.object({
  camera: z.object({
    center: z.tuple([z.number().finite(), z.number().finite()]),
    rotX: z.number().finite().min(-360).max(360),
    rotY: z.number().finite().min(-360).max(360),
    zoom: z.number().finite().positive().max(500),
  }).strict(),
  legend: legendSchema,
  parts: z.array(glyphPartSchema).min(1).max(MAX_RECIPE_PARTS),
  seed: z.string().min(1).max(128),
  sourceHash: z.string().regex(/^[0-9a-f]{16}$/),
}).strict();

const glyphRecipeV1Schema = glyphRecipeCoreSchema.extend({
  labels: glyphLabelsV1Schema,
  version: z.literal(LEGACY_GLYPH_RECIPE_VERSION),
}).strict().superRefine(validateUniquePartIds);

const glyphRecipeV2Schema = glyphRecipeCoreSchema.extend({
  labels: glyphLabelsV2Schema,
  style: z.object({
    cellPalette: z.enum(["initial", "prelog"]),
    renderMode: z.enum(["solid", "wireframe"]),
  }).strict(),
  version: z.literal(INITIAL_GLYPH_RECIPE_VERSION),
}).strict().superRefine(validateUniquePartIds);

export const currentGlyphRecipeSchema = glyphRecipeCoreSchema.extend({
  labels: glyphLabelsV2Schema,
  style: z.object({
    cellPalette: z.enum(["initial", "prelog"]),
    renderMode: z.enum(["solid", "wireframe"]),
  }).strict(),
  version: z.literal(GLYPH_RECIPE_VERSION),
}).strict().superRefine(validateUniquePartIds);

export const glyphRecipeSchema = z.discriminatedUnion("version", [
  glyphRecipeV1Schema,
  glyphRecipeV2Schema,
  currentGlyphRecipeSchema,
]);

function validateUniquePartIds(recipe: { readonly parts: readonly z.infer<typeof glyphPartSchema>[] }, context: z.RefinementCtx) {
  const ids = new Set<string>();

  recipe.parts.forEach((part, index) => {
    if (ids.has(part.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate glyph part id: ${part.id}`,
        path: ["parts", index, "id"],
      });
    }
    ids.add(part.id);
  });
}

const sectionSignalSchema = z.object({
  charCount: z.number().int().nonnegative(),
  codeBlockCount: z.number().int().nonnegative(),
  h3Count: z.number().int().nonnegative(),
  imageCount: z.number().int().nonnegative(),
  listCount: z.number().int().nonnegative(),
  quoteCount: z.number().int().nonnegative(),
  title: z.string().min(1).max(1000),
}).strict();

const articleGlyphSignalsSchema = z.object({
  sections: z.array(sectionSignalSchema).min(1).max(MAX_SECTIONS),
  totals: z.object({
    charCount: z.number().int().nonnegative(),
    codeBlocks: z.number().int().nonnegative(),
    headings: z.number().int().nonnegative(),
    images: z.number().int().nonnegative(),
    lists: z.number().int().nonnegative(),
    quotes: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const articleRecipeInputSchema = z.object({
  category: z.string().max(256).nullable(),
  labels: z.object({
    category: z.string().max(256).nullable(),
    tags: z.array(z.string().max(128)).max(64),
  }).strict(),
  postId: z.string().min(1).max(256),
  signals: articleGlyphSignalsSchema,
  tags: z.array(z.string().max(128)).max(64),
  title: z.string().min(1).max(1000),
}).strict();

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

export type GlyphPart = z.infer<typeof glyphPartSchema>;
export type GlyphRecipeV1 = z.infer<typeof glyphRecipeV1Schema>;
export type GlyphRecipeV2 = z.infer<typeof glyphRecipeV2Schema>;
export type GlyphRecipeV3 = z.infer<typeof currentGlyphRecipeSchema>;
export type GlyphRecipe = z.infer<typeof glyphRecipeSchema>;
export type SectionSignal = z.infer<typeof sectionSignalSchema>;
export type ArticleGlyphSignals = z.infer<typeof articleGlyphSignalsSchema>;
export type GlyphRenderPreset = "thumbnail" | "feature" | "social";
export type GlyphPreset = GlyphRenderPreset;

type ArticleRecipeInput = {
  readonly category: string | null;
  readonly labels: {
    readonly category: string | null;
    readonly tags: readonly string[];
  };
  readonly postId: string;
  readonly signals: ArticleGlyphSignals;
  readonly tags: readonly string[];
  readonly title: string;
};

type PendingSection = {
  readonly nodes: RootContent[];
  readonly title: string;
};

const RENDER_PRESETS: Record<GlyphRenderPreset, {
  readonly cols: number;
  readonly rows: number;
  readonly staticZoomMultiplier: number;
}> = {
  feature: { cols: 80, rows: 40, staticZoomMultiplier: 5 },
  social: { cols: 80, rows: 40, staticZoomMultiplier: 5 },
  thumbnail: { cols: 28, rows: 14, staticZoomMultiplier: 1.75 },
};

export function createArticleGlyphSignals(markdown: string): ArticleGlyphSignals {
  const source = z.string().parse(markdown);
  const tree = markdownProcessor.parse(source) as Root;
  const pendingSections = capSections(splitSections(tree));
  const sections = pendingSections.map(createSectionSignal);
  const totals = createTotals(tree, sections);

  return articleGlyphSignalsSchema.parse({ sections, totals });
}

export function createArticleGlyphRecipe(input: ArticleRecipeInput): GlyphRecipeV3 {
  const parsed = articleRecipeInputSchema.parse({
    ...input,
    labels: { ...input.labels, tags: [...input.labels.tags] },
    tags: [...input.tags],
  });
  const normalized = normalizeArticleInput(parsed);
  const initial = createTitleInitial(normalized.labels.title);
  const sourceHash = hash64Hex(JSON.stringify({
    coverStyle: TITLE_INITIAL_STYLE,
    category: normalized.category,
    initial,
    labels: normalized.labels,
    recipeVersion: GLYPH_RECIPE_VERSION,
    signals: normalized.signals,
    tags: normalized.tags,
  }));
  const parts = createArticleFingerprintParts(initial, normalized.signals);
  const camera = createArticleCamera(parts);
  const seed = `article-v3-${hash64Hex(`${normalized.postId}:${sourceHash}`)}`;

  return currentGlyphRecipeSchema.parse({
    camera,
    labels: { ...normalized.labels, initial },
    legend: {
      codeBlocks: normalized.signals.totals.codeBlocks,
      images: normalized.signals.totals.images,
      lists: normalized.signals.totals.lists,
      quotes: normalized.signals.totals.quotes,
      sections: normalized.signals.sections.length,
    },
    parts,
    seed,
    sourceHash,
    style: { cellPalette: "initial", renderMode: "solid" },
    version: GLYPH_RECIPE_VERSION,
  });
}

export function createPrelogEngineRecipe(): GlyphRecipeV2 {
  const seed = "prelog-engine-v2";
  const parts = createTitleInitialParts("P").map((part) => ({
    ...part,
    id: part.id.replace("initial-p-", "engine-p-"),
    scale: [0.9, part.scale[1], part.scale[2]] as [number, number, number],
  }));

  return glyphRecipeV2Schema.parse({
    camera: { center: [0.5, 0.5], rotX: 84, rotY: -7, zoom: 38 },
    labels: { category: null, initial: "P", tags: [], title: "Prelog" },
    legend: { codeBlocks: 0, images: 0, lists: 0, quotes: 0, sections: 4 },
    parts,
    seed,
    sourceHash: hash64Hex(`${seed}:v${INITIAL_GLYPH_RECIPE_VERSION}`),
    style: { cellPalette: "prelog", renderMode: "solid" },
    version: INITIAL_GLYPH_RECIPE_VERSION,
  });
}

export function renderGlyphRecipe(recipe: GlyphRecipe, preset: GlyphRenderPreset): string {
  const validated = glyphRecipeSchema.parse(recipe);
  const renderPreset = RENDER_PRESETS[preset];
  const polygons = validated.parts.flatMap(buildGlyphPartPolygons);
  const camera = createGlyphOrthographicCamera({
    center: validated.camera.center,
    rotX: validated.camera.rotX,
    rotY: validated.camera.rotY,
    zoom: validated.camera.zoom * renderPreset.staticZoomMultiplier,
  });
  const context = buildRasterizeContext({
    camera,
    glyphPalette: "solid",
    grid: { cellAspect: GLYPH_CELL_ASPECT, cols: renderPreset.cols, rows: renderPreset.rows },
    mode: getRuntimeGlyphRenderMode(validated),
    polygons,
    transformCells: createGlyphCellTransform(validated.seed, getRuntimeGlyphCellCharacters(validated)),
    useColors: false,
  });

  const output = rasterize(context);
  if (output.trim().length === 0) {
    throw new Error(`Glyph recipe rendered no visible cells for preset "${preset}".`);
  }

  return output;
}

export function getGlyphRuntimeCamera(recipe: GlyphRecipe, preset: GlyphRenderPreset) {
  const validated = glyphRecipeSchema.parse(recipe);
  return getRuntimeGlyphCamera(validated, preset);
}

export function getGlyphRecipeInitial(recipe: GlyphRecipe) {
  return recipe.version === LEGACY_GLYPH_RECIPE_VERSION ? null : recipe.labels.initial;
}

export function createGlyphCellTransform(seed: string, characters: readonly string[] = CELL_CHARACTERS) {
  return createRuntimeGlyphCellTransform(z.string().min(1).parse(seed), characters);
}

export function buildGlyphPartPolygons(part: GlyphPart): Polygon[] {
  const validated = glyphPartSchema.parse(part);
  return buildRuntimeGlyphPartPolygons(validated);
}

function splitSections(tree: Root): PendingSection[] {
  const leading: RootContent[] = [];
  const sections: { nodes: RootContent[]; title: string }[] = [];

  tree.children.forEach((node) => {
    if (node.type === "heading" && node.depth === 2) {
      sections.push({ nodes: [node], title: getNodeText(node) || FALLBACK_SECTION_TITLE });
      return;
    }
    const current = sections.at(-1);
    (current ? current.nodes : leading).push(node);
  });

  if (sections.length === 0) {
    return [{ nodes: leading, title: getFallbackSectionTitle(tree) }];
  }

  sections[0].nodes.unshift(...leading);
  return sections;
}

function capSections(sections: readonly PendingSection[]): PendingSection[] {
  if (sections.length <= MAX_SECTIONS) {
    return sections.map((section) => ({ nodes: [...section.nodes], title: section.title }));
  }

  const retained = sections.slice(0, MAX_SECTIONS - 1).map((section) => ({
    nodes: [...section.nodes],
    title: section.title,
  }));
  const overflow = sections.slice(MAX_SECTIONS - 1);
  retained.push({
    nodes: overflow.flatMap((section) => section.nodes),
    title: overflow[0].title,
  });
  return retained;
}

function createSectionSignal(section: PendingSection): SectionSignal {
  const root: Root = { children: section.nodes, type: "root" };
  let codeBlockCount = 0;
  let h3Count = 0;
  let imageCount = 0;
  let listCount = 0;
  let quoteCount = 0;

  visit(root, (node) => {
    if (node.type === "heading" && node.depth === 3) h3Count += 1;
    if (node.type === "code") codeBlockCount += 1;
    if (node.type === "blockquote") quoteCount += 1;
    if (node.type === "list") listCount += 1;
    if (node.type === "image" || node.type === "imageReference") imageCount += 1;
  });

  return {
    charCount: countNodeCharacters(root),
    codeBlockCount,
    h3Count,
    imageCount,
    listCount,
    quoteCount,
    title: normalizeText(section.title) || FALLBACK_SECTION_TITLE,
  };
}

function createTotals(tree: Root, sections: readonly SectionSignal[]) {
  let headings = 0;
  visit(tree, "heading", () => {
    headings += 1;
  });

  return sections.reduce((totals, section) => ({
    charCount: totals.charCount + section.charCount,
    codeBlocks: totals.codeBlocks + section.codeBlockCount,
    headings,
    images: totals.images + section.imageCount,
    lists: totals.lists + section.listCount,
    quotes: totals.quotes + section.quoteCount,
  }), { charCount: 0, codeBlocks: 0, headings, images: 0, lists: 0, quotes: 0 });
}

function getFallbackSectionTitle(tree: Root) {
  const heading = tree.children.find((node) => node.type === "heading" && node.depth === 1);
  return heading ? getNodeText(heading) || FALLBACK_SECTION_TITLE : FALLBACK_SECTION_TITLE;
}

function getNodeText(node: Root | RootContent) {
  const chunks: string[] = [];
  visit(node, (child) => {
    if (child.type === "text" || child.type === "inlineCode" || child.type === "code") {
      chunks.push(child.value);
    } else if ((child.type === "image" || child.type === "imageReference") && child.alt) {
      chunks.push(child.alt);
    }
  });
  return normalizeText(chunks.join(" "));
}

function countNodeCharacters(node: Root) {
  return Array.from(getNodeText(node).replace(/\s/gu, "")).length;
}

function normalizeArticleInput(input: z.infer<typeof articleRecipeInputSchema>) {
  const tags = [...new Set(input.tags.map(normalizeText).filter(Boolean))].sort(compareText);
  const labelTags = [...new Set(input.labels.tags.map(normalizeText).filter(Boolean))].sort(compareText);
  return {
    category: input.category ? normalizeText(input.category) : null,
    labels: {
      category: input.labels.category ? normalizeText(input.labels.category) : null,
      tags: labelTags,
      title: normalizeText(input.title),
    },
    postId: normalizeText(input.postId),
    signals: input.signals,
    tags,
  };
}

function createArticleCamera(parts: readonly GlyphPart[]) {
  const rotX = ARTICLE_INITIAL_ROT_X;
  const rotY = ARTICLE_CAMERA_ROT_Y;
  const vertices = parts.flatMap(buildGlyphPartPolygons).flatMap((polygon) => polygon.vertices);
  const unitBounds = projectBounds({ rotX, rotY, vertices, zoom: 1 });
  const effectiveZoom = Math.min(
    ARTICLE_FIT_WIDTH / getBoundsWidth(unitBounds),
    ARTICLE_FIT_HEIGHT / getBoundsHeight(unitBounds),
  );
  const fittedBounds = projectBounds({ rotX, rotY, vertices, zoom: effectiveZoom });

  return {
    center: [
      roundMetric(0.5 - midpoint(fittedBounds.minX, fittedBounds.maxX) / ARTICLE_FIT_COLUMNS),
      roundMetric(0.5 - midpoint(fittedBounds.minY, fittedBounds.maxY) / ARTICLE_FIT_ROWS),
    ] as [number, number],
    rotX,
    rotY,
    zoom: roundMetric(effectiveZoom / RENDER_PRESETS.feature.staticZoomMultiplier),
  };
}

function projectBounds(options: {
  readonly rotX: number;
  readonly rotY: number;
  readonly vertices: readonly Vec3[];
  readonly zoom: number;
}) {
  const camera = createGlyphOrthographicCamera({
    center: [0, 0],
    rotX: options.rotX,
    rotY: options.rotY,
    zoom: options.zoom,
  });
  const points = options.vertices.map((vertex) =>
    camera.project(vertex, ARTICLE_FIT_COLUMNS, ARTICLE_FIT_ROWS, GLYPH_CELL_ASPECT),
  );
  const x = points.map((point) => point[0]);
  const y = points.map((point) => point[1]);

  return { maxX: Math.max(...x), maxY: Math.max(...y), minX: Math.min(...x), minY: Math.min(...y) };
}

function getBoundsWidth(bounds: ReturnType<typeof projectBounds>) {
  const width = bounds.maxX - bounds.minX;
  if (!(width > 0)) throw new Error("Glyph recipe has no projected width.");
  return width;
}

function getBoundsHeight(bounds: ReturnType<typeof projectBounds>) {
  const height = bounds.maxY - bounds.minY;
  if (!(height > 0)) throw new Error("Glyph recipe has no projected height.");
  return height;
}

function midpoint(start: number, end: number) {
  return (start + end) / 2;
}

function createTitleInitialParts(initial: string) {
  return getTitleGlyphPattern(initial).flatMap((row, rowIndex) =>
    createInitialRowParts({ initial, row, rowIndex })
  );
}

function createArticleFingerprintParts(initial: string, signals: ArticleGlyphSignals) {
  const initialParts = createTitleInitialParts(initial);
  const bounds = getInitialBounds(initialParts);
  const fingerprintParts = initialParts.map((part) => addSectionFingerprint(part, signals));

  return [
    ...fingerprintParts,
    ...createCodeFingerprintParts(bounds, signals.totals.codeBlocks),
    ...createQuoteFingerprintParts(bounds, signals.totals.quotes),
    ...createListFingerprintParts(bounds, signals.totals.lists),
    ...createImageFingerprintParts(bounds, signals.totals.images),
  ];
}

function addSectionFingerprint(part: GlyphPart, signals: ArticleGlyphSignals): GlyphPart {
  const rowIndex = Math.round((TITLE_GLYPH_ROWS - 1) / 2 - part.position[2]);
  const sectionIndex = Math.min(
    signals.sections.length - 1,
    Math.floor(rowIndex * signals.sections.length / TITLE_GLYPH_ROWS),
  );
  const section = signals.sections[sectionIndex];
  const maxCharacters = Math.max(1, ...signals.sections.map(({ charCount }) => charCount));
  const contentRatio = Math.log1p(section.charCount) / Math.log1p(maxCharacters);
  const depth = INITIAL_CELL_DEPTH + SECTION_DEPTH_BASE + SECTION_DEPTH_RANGE * contentRatio;
  const sectionInset = isSectionDividerRow(rowIndex, signals.sections.length) ? SECTION_DIVIDER_INSET : 0;
  const h3Inset = Math.min(MAX_H3_DIVIDER_INSET, section.h3Count * H3_DIVIDER_INSET);

  return {
    ...part,
    position: [roundMetric((INITIAL_CELL_DEPTH - depth) / 2), part.position[1], part.position[2]],
    scale: [roundMetric(depth), part.scale[1], roundMetric(INITIAL_CELL_HEIGHT - sectionInset - h3Inset)],
  };
}

function isSectionDividerRow(rowIndex: number, sectionCount: number) {
  if (sectionCount <= 1) return false;

  for (let section = 1; section < sectionCount; section += 1) {
    if (rowIndex === Math.round(section * TITLE_GLYPH_ROWS / sectionCount) - 1) return true;
  }
  return false;
}

type InitialBounds = {
  readonly maxY: number;
  readonly maxZ: number;
  readonly minY: number;
  readonly minZ: number;
};

function getInitialBounds(parts: readonly GlyphPart[]): InitialBounds {
  return parts.reduce<InitialBounds>((bounds, part) => ({
    maxY: Math.max(bounds.maxY, part.position[1] + part.scale[1] / 2),
    maxZ: Math.max(bounds.maxZ, part.position[2] + part.scale[2] / 2),
    minY: Math.min(bounds.minY, part.position[1] - part.scale[1] / 2),
    minZ: Math.min(bounds.minZ, part.position[2] - part.scale[2] / 2),
  }), {
    maxY: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
  });
}

function createCodeFingerprintParts(bounds: InitialBounds, count: number) {
  const partCount = Math.min(count, MAX_CODE_PARTS);
  const intensity = getFeatureIntensity(count);
  return Array.from({ length: partCount }, (_, index) => {
    const width = 0.34 + intensity * 0.1;
    const depth = FEATURE_DEPTH + intensity * 0.22;
    return createPart(
      "box",
      `structure-code-${index + 1}`,
      [getRearBiasedCenter(depth), bounds.minY - width / 2 + FEATURE_OVERLAP, getFeatureZ(bounds, index, partCount, "upper")],
      [0, 0, 0],
      [depth, width, 0.18 + intensity * 0.05],
    );
  });
}

function createQuoteFingerprintParts(bounds: InitialBounds, count: number) {
  const partCount = Math.min(count, MAX_QUOTE_PARTS);
  const intensity = getFeatureIntensity(count);
  const size = 0.66 + intensity * 0.18;
  return Array.from({ length: partCount }, (_, index) => createPart(
    "ring",
    `structure-quote-${index + 1}`,
    [getRearBiasedCenter(FEATURE_DEPTH), bounds.maxY + size / 2 - FEATURE_OVERLAP, getFeatureZ(bounds, index, partCount, "upper")],
    [0, 90, 0],
    [size, size, FEATURE_DEPTH],
  ));
}

function createListFingerprintParts(bounds: InitialBounds, count: number) {
  const partCount = Math.min(count, MAX_LIST_PARTS);
  const intensity = getFeatureIntensity(count);
  return Array.from({ length: partCount }, (_, index) => {
    const width = 0.28 + index * 0.1 + intensity * 0.06;
    const depth = FEATURE_DEPTH + index * 0.06;
    return createPart(
      "box",
      `structure-list-${index + 1}`,
      [getRearBiasedCenter(depth), bounds.minY - width / 2 + FEATURE_OVERLAP, bounds.minZ + 0.32 + index * 0.28],
      [0, 0, 0],
      [depth, width, 0.16],
    );
  });
}

function createImageFingerprintParts(bounds: InitialBounds, count: number) {
  const partCount = Math.min(count, MAX_IMAGE_PARTS);
  const intensity = getFeatureIntensity(count);
  const size = 0.72 + intensity * 0.2;
  return Array.from({ length: partCount }, (_, index) => createPart(
    "frame",
    `structure-image-${index + 1}`,
    [getRearBiasedCenter(FEATURE_DEPTH), bounds.maxY + size / 2 - FEATURE_OVERLAP, getFeatureZ(bounds, index, partCount, "lower")],
    [0, 90, 0],
    [size, size, FEATURE_DEPTH],
  ));
}

function getFeatureZ(bounds: InitialBounds, index: number, count: number, region: "lower" | "upper") {
  const midpointZ = midpoint(bounds.minZ, bounds.maxZ);
  const start = region === "upper" ? bounds.maxZ - FEATURE_VERTICAL_MARGIN : bounds.minZ + FEATURE_VERTICAL_MARGIN;
  const end = region === "upper" ? midpointZ + FEATURE_VERTICAL_MARGIN / 2 : midpointZ - FEATURE_VERTICAL_MARGIN / 2;
  if (count === 1) return roundMetric(midpoint(start, end));
  return roundMetric(start + (end - start) * index / (count - 1));
}

function getRearBiasedCenter(depth: number) {
  return roundMetric((INITIAL_CELL_DEPTH - depth) / 2);
}

function getFeatureIntensity(count: number) {
  return Math.min(count, FEATURE_COUNT_SCALE_LIMIT) / FEATURE_COUNT_SCALE_LIMIT;
}

function createInitialRowParts(options: { readonly initial: string; readonly row: string; readonly rowIndex: number }) {
  const parts: GlyphPart[] = [];
  let runStart = -1;

  for (let column = 0; column <= TITLE_GLYPH_COLUMNS; column += 1) {
    if (options.row[column] === "1" && runStart === -1) {
      runStart = column;
    }

    if (options.row[column] !== "1" && runStart !== -1) {
      parts.push(createInitialRunPart({ ...options, runLength: column - runStart, runStart }));
      runStart = -1;
    }
  }

  return parts;
}

function createInitialRunPart(options: {
  readonly initial: string;
  readonly rowIndex: number;
  readonly runLength: number;
  readonly runStart: number;
}) {
  const columnCenter = options.runStart + (options.runLength - 1) / 2;
  const y = columnCenter - (TITLE_GLYPH_COLUMNS - 1) / 2;
  const z = (TITLE_GLYPH_ROWS - 1) / 2 - options.rowIndex;
  return createPart(
    "box",
    `initial-${options.initial.toLowerCase()}-r${options.rowIndex + 1}-c${options.runStart + 1}`,
    [0, y, z],
    [0, 0, 0],
    [INITIAL_CELL_DEPTH, options.runLength - INITIAL_RUN_INSET, INITIAL_CELL_HEIGHT],
  );
}

function createPart(
  kind: GlyphPart["kind"],
  id: string,
  position: Vec3,
  rotation: Vec3,
  scale: Vec3,
): GlyphPart {
  return { color: DEFAULT_PART_COLOR, id, kind, position, rotation, scale };
}

function hash64Hex(value: string) {
  let hash = HASH_64_OFFSET;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * HASH_64_PRIME);
  }
  return hash.toString(16).padStart(16, "0");
}

function normalizeText(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function compareText(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}
