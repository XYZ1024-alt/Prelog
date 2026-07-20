import { describe, expect, test } from "vitest";

import {
  buildGlyphPartPolygons,
  createArticleGlyphRecipe,
  createArticleGlyphSignals,
  createGlyphCellTransform,
  createPrelogEngineRecipe,
  currentGlyphRecipeSchema,
  getGlyphRecipeInitial,
  getGlyphRuntimeCamera,
  glyphRecipeSchema,
  renderGlyphRecipe,
  type ArticleGlyphSignals,
  type GlyphPart,
} from "./glyph-recipe.ts";
import {
  getTitleGlyphPattern,
  TITLE_GLYPH_CHARACTERS,
  TITLE_GLYPH_COLUMNS,
  TITLE_GLYPH_ROWS,
} from "./glyph-initial-font.ts";
import { getRuntimeGlyphRenderMode } from "./glyph-runtime.ts";

describe("article glyph signals", () => {
  test("maps Markdown AST nodes into H2 sections and includes leading content", () => {
    const markdown = [
      "# Article",
      "",
      "Leading copy.",
      "",
      "## Structure",
      "",
      "### Detail",
      "",
      "```ts",
      "const answer = 42;",
      "```",
      "",
      "> Quoted",
      "",
      "- first",
      "- second",
      "",
      "![diagram](diagram.png)",
      "",
      "## Finish",
      "",
      "Final copy.",
    ].join("\n");

    const signals = createArticleGlyphSignals(markdown);

    expect(signals.sections).toHaveLength(2);
    expect(signals.sections[0]).toMatchObject({
      codeBlockCount: 1,
      h3Count: 1,
      imageCount: 1,
      listCount: 1,
      quoteCount: 1,
      title: "Structure",
    });
    expect(signals.sections[0].charCount).toBeGreaterThan("Leadingcopy".length);
    expect(signals.totals).toMatchObject({
      codeBlocks: 1,
      headings: 4,
      images: 1,
      lists: 1,
      quotes: 1,
    });
    expect(signals.totals.charCount).toBe(
      signals.sections.reduce((sum, section) => sum + section.charCount, 0),
    );
  });

  test("falls back to one full-document section when no H2 exists", () => {
    const signals = createArticleGlyphSignals("# Standalone\n\nBody with `code`.\n\n> Quote");

    expect(signals.sections).toHaveLength(1);
    expect(signals.sections[0]).toMatchObject({ quoteCount: 1, title: "Standalone" });
    expect(signals.totals.headings).toBe(1);
  });

  test("caps at eight sections and aggregates overflow into the eighth", () => {
    const markdown = Array.from({ length: 10 }, (_, index) => (
      `## Section ${index + 1}\n\n${"x".repeat(index + 1)}`
    )).join("\n\n");

    const signals = createArticleGlyphSignals(markdown);

    expect(signals.sections).toHaveLength(8);
    expect(signals.sections[7].title).toBe("Section 8");
    expect(signals.sections[7].charCount).toBeGreaterThan(signals.sections[6].charCount);
    expect(signals.totals.headings).toBe(10);
  });
});

describe("glyph recipes", () => {
  test("is deterministic and insensitive to tag order", () => {
    const signals = createArticleGlyphSignals("## One\n\nText\n\n### Detail");
    const base = {
      category: "engineering",
      postId: "post-1",
      signals,
      title: "Deterministic systems",
    } as const;

    const first = createArticleGlyphRecipe({
      ...base,
      labels: { category: "Engineering", tags: ["TypeScript", "Design"] },
      tags: ["type-script", "design"],
    });
    const second = createArticleGlyphRecipe({
      ...base,
      labels: { category: "Engineering", tags: ["Design", "TypeScript"] },
      tags: ["design", "type-script"],
    });

    expect(first).toEqual(second);
    expect(first.labels).toEqual({
      category: "Engineering",
      initial: "D",
      tags: ["Design", "TypeScript"],
      title: "Deterministic systems",
    });
    expect(first.style).toEqual({ cellPalette: "initial", renderMode: "solid" });
    expect(first.version).toBe(3);
    expect(first.sourceHash).toMatch(/^[0-9a-f]{16}$/);
    expect(glyphRecipeSchema.parse(first)).toEqual(first);
  });

  test("keeps camera content-driven while post id only changes the seed", () => {
    const signals = createArticleGlyphSignals("## One\n\nText");
    const input = {
      category: "engineering",
      labels: { category: "Engineering", tags: ["Design"] },
      signals,
      tags: ["design"],
      title: "Content identity",
    } as const;
    const first = createArticleGlyphRecipe({ ...input, postId: "post-a" });
    const second = createArticleGlyphRecipe({ ...input, postId: "post-b" });

    expect(first.sourceHash).toBe(second.sourceHash);
    expect(first.camera).toEqual(second.camera);
    expect(first.parts).toEqual(second.parts);
    expect(first.seed).not.toBe(second.seed);
  });

  test("changes the source hash but keeps the letter geometry when display labels change", () => {
    const input = {
      category: "engineering",
      postId: "post-labels",
      signals: createArticleGlyphSignals("## One\n\nText"),
      tags: ["design"],
      title: "Locked labels",
    } as const;
    const first = createArticleGlyphRecipe({
      ...input,
      labels: { category: "Engineering", tags: ["Design"] },
    });
    const second = createArticleGlyphRecipe({
      ...input,
      labels: { category: "Product", tags: ["Interface"] },
    });

    expect(first.sourceHash).not.toBe(second.sourceHash);
    expect(first.parts).toEqual(second.parts);
  });

  test("changes candidates when title, taxonomy, or structure changes", () => {
    const base = {
      category: "engineering",
      labels: { category: "Engineering", tags: ["Design"] },
      postId: "post-candidate",
      signals: createArticleGlyphSignals("## One\n\nText"),
      tags: ["design"],
      title: "Original title",
    } as const;
    const sourceHash = createArticleGlyphRecipe(base).sourceHash;
    const variants = [
      { ...base, title: "Changed title" },
      { ...base, category: "product" },
      { ...base, tags: ["systems"] },
      { ...base, signals: createArticleGlyphSignals("## One\n\nText\n\n## Two\n\n> Quote") },
    ];

    variants.forEach((variant) => {
      expect(createArticleGlyphRecipe(variant).sourceHash).not.toBe(sourceHash);
    });
  });

  test("keeps the title initial legible while mapping structure into restrained geometry", () => {
    const signals: ArticleGlyphSignals = {
      sections: [{
        charCount: 200,
        codeBlockCount: 4,
        h3Count: 5,
        imageCount: 3,
        listCount: 4,
        quoteCount: 2,
        title: "Dense section",
      }],
      totals: { charCount: 200, codeBlocks: 4, headings: 6, images: 3, lists: 4, quotes: 2 },
    };

    const recipe = createArticleGlyphRecipe({
      category: null,
      labels: { category: null, tags: [] },
      postId: "post-2",
      signals,
      tags: [],
      title: "Mapping",
    });

    expect(getGlyphRecipeInitial(recipe)).toBe("M");
    expect(recipe.parts.length).toBeGreaterThan(0);
    expect(recipe.parts.some((part) => part.id.startsWith("initial-m-"))).toBe(true);
    expect(recipe.parts.some((part) => part.id.startsWith("structure-code-"))).toBe(true);
    expect(recipe.parts.some((part) => part.kind === "ring")).toBe(true);
    expect(recipe.parts.some((part) => part.kind === "frame")).toBe(true);
    expect(recipe.camera).toMatchObject({ rotX: 90, rotY: -8 });
    expect(recipe.legend).toEqual({ codeBlocks: 4, images: 3, lists: 4, quotes: 2, sections: 1 });
  });

  test("creates different parts and rendered fingerprints for the same initial", () => {
    const base = {
      category: null,
      labels: { category: null, tags: [] },
      postId: "post-fingerprint",
      tags: [],
      title: "Architecture",
    } as const;
    const prose = createArticleGlyphRecipe({
      ...base,
      signals: createArticleGlyphSignals("## Foundation\n\nA short introduction."),
    });
    const structured = createArticleGlyphRecipe({
      ...base,
      signals: createArticleGlyphSignals([
        "## Foundation",
        "",
        "### Boundary",
        "",
        "```ts",
        "const boundary = true;",
        "```",
        "",
        "> A deliberate constraint.",
        "",
        "- one",
        "- two",
        "",
        "![system map](map.png)",
        "",
        "## Runtime",
        "",
        "A second section with substantially more detail.",
      ].join("\n")),
    });

    expect(prose.labels.initial).toBe(structured.labels.initial);
    expect(prose.parts).not.toEqual(structured.parts);
    expect(
      prose.parts.filter((part) => part.id.startsWith("initial-a-")),
    ).not.toEqual(structured.parts.filter((part) => part.id.startsWith("initial-a-")));
    expect(structured.parts.some((part) => part.id.startsWith("structure-code-"))).toBe(true);
    expect(structured.parts.some((part) => part.id.startsWith("structure-quote-"))).toBe(true);
    expect(structured.parts.some((part) => part.id.startsWith("structure-list-"))).toBe(true);
    expect(structured.parts.some((part) => part.id.startsWith("structure-image-"))).toBe(true);
    expect(renderGlyphRecipe(prose, "feature")).not.toBe(renderGlyphRecipe(structured, "feature"));
  });

  test("builds a recognizable nine-part Prelog P", () => {
    const recipe = createPrelogEngineRecipe();

    expect(recipe.parts).toHaveLength(9);
    expect(recipe.parts.map((part) => part.id)).toEqual([
      "engine-p-r1-c1",
      "engine-p-r2-c1",
      "engine-p-r2-c5",
      "engine-p-r3-c1",
      "engine-p-r3-c5",
      "engine-p-r4-c1",
      "engine-p-r5-c1",
      "engine-p-r6-c1",
      "engine-p-r7-c1",
    ]);
    expect(recipe.parts.every((part) => part.kind === "box" && part.scale[0] === 0.9)).toBe(true);
    expect(recipe.camera).toEqual({ center: [0.5, 0.5], rotX: 84, rotY: -7, zoom: 38 });
    expect(recipe.labels.initial).toBe("P");
    expect(recipe.version).toBe(2);
    expect(recipe.style).toEqual({ cellPalette: "prelog", renderMode: "solid" });
    expect(getRuntimeGlyphRenderMode(recipe)).toBe(recipe.style.renderMode);
  });

  test("reads V1 and V2 recipes while only accepting V3 as current", () => {
    const versionTwo = createPrelogEngineRecipe();
    const legacy = {
      camera: versionTwo.camera,
      labels: {
        category: versionTwo.labels.category,
        tags: versionTwo.labels.tags,
        title: versionTwo.labels.title,
      },
      legend: versionTwo.legend,
      parts: versionTwo.parts,
      seed: versionTwo.seed,
      sourceHash: versionTwo.sourceHash,
      version: 1 as const,
    };
    const versionThree = createArticleGlyphRecipe({
      category: null,
      labels: { category: null, tags: [] },
      postId: "post-v3",
      signals: createArticleGlyphSignals("## Current\n\nRecipe"),
      tags: [],
      title: "Versioned",
    });

    expect(glyphRecipeSchema.parse(legacy).version).toBe(1);
    expect(glyphRecipeSchema.parse(versionTwo).version).toBe(2);
    expect(glyphRecipeSchema.parse(versionThree).version).toBe(3);
    expect(currentGlyphRecipeSchema.safeParse(legacy).success).toBe(false);
    expect(currentGlyphRecipeSchema.safeParse(versionTwo).success).toBe(false);
    expect(currentGlyphRecipeSchema.safeParse(versionThree).success).toBe(true);
    expect(renderGlyphRecipe(glyphRecipeSchema.parse(legacy), "thumbnail").trim()).not.toBe("");
    expect(renderGlyphRecipe(glyphRecipeSchema.parse(versionTwo), "thumbnail").trim()).not.toBe("");
  });

  test("strict schema rejects unknown data and invalid transforms", () => {
    const recipe = createPrelogEngineRecipe();

    expect(glyphRecipeSchema.safeParse({ ...recipe, unexpected: true }).success).toBe(false);
    expect(glyphRecipeSchema.safeParse({ ...recipe, labels: undefined }).success).toBe(false);
    expect(glyphRecipeSchema.safeParse({ ...recipe, camera: { ...recipe.camera, center: [0] } }).success).toBe(false);
    expect(glyphRecipeSchema.safeParse({
      ...recipe,
      parts: [{ ...recipe.parts[0], scale: [0, 1, 1] }],
    }).success).toBe(false);
    expect(glyphRecipeSchema.safeParse({
      ...recipe,
      parts: [recipe.parts[0], recipe.parts[0]],
    }).success).toBe(false);
  });
});

describe("glyph rendering", () => {
  test("defines a unique 5x7 pattern for every supported title initial", () => {
    const patterns = Array.from(TITLE_GLYPH_CHARACTERS, (initial) => getTitleGlyphPattern(initial));

    expect(new Set(patterns.map((pattern) => pattern.join("/"))).size).toBe(TITLE_GLYPH_CHARACTERS.length);
    patterns.forEach((pattern) => {
      expect(pattern).toHaveLength(TITLE_GLYPH_ROWS);
      expect(pattern.every((row) => row.length === TITLE_GLYPH_COLUMNS && /^[01]+$/.test(row))).toBe(true);
    });
  });

  test("bakes each part transform into its polygons", () => {
    const part: GlyphPart = {
      color: "#ffffff",
      id: "test-box",
      kind: "box",
      position: [3, -2, 5],
      rotation: [0, 0, 0],
      scale: [2, 4, 6],
    };

    const vertices = buildGlyphPartPolygons(part).flatMap((polygon) => polygon.vertices);
    const xs = vertices.map((vertex) => vertex[0]);
    const ys = vertices.map((vertex) => vertex[1]);
    const zs = vertices.map((vertex) => vertex[2]);

    expect([Math.min(...xs), Math.max(...xs)]).toEqual([2, 4]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([-4, 0]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([2, 8]);
  });

  test("rewrites occupied cells deterministically while preserving spaces", () => {
    const createGrid = () => ({
      char: ["#", " ", "#", "#"],
      color: [null, null, null, null],
      cols: 2,
      depth: new Float64Array([0, Number.NEGATIVE_INFINITY, 0, 0]),
      rows: 2,
      screenX: new Int32Array([0, 1, 0, 1]),
      screenY: new Int32Array([0, 0, 1, 1]),
    });
    const first = createGrid();
    const second = createGrid();

    createGlyphCellTransform("seed-a")(first);
    createGlyphCellTransform("seed-a")(second);

    expect(first.char).toEqual(second.char);
    expect(first.char[1]).toBe(" ");
    expect(first.char.some((character) => character !== "#" && character !== " ")).toBe(true);
  });

  test.each([
    ["thumbnail", 28, 14],
    ["feature", 80, 40],
    ["social", 80, 40],
  ] as const)("renders deterministic %s output", (preset, cols, rows) => {
    const recipe = createPrelogEngineRecipe();
    const first = renderGlyphRecipe(recipe, preset);
    const second = renderGlyphRecipe(recipe, preset);
    const lines = first.split("\n");

    expect(first).toBe(second);
    expect(lines).toHaveLength(rows);
    expect(lines.every((line) => line.length === cols)).toBe(true);
    expect(first.replace(/\s/g, "").length).toBeGreaterThan(0);
  });

  test("keeps the Prelog feature render aligned with its runtime camera", () => {
    const recipe = createPrelogEngineRecipe();
    const runtimeCamera = getGlyphRuntimeCamera(recipe, "feature");
    const output = renderGlyphRecipe(recipe, "feature");
    const bounds = getOccupiedBounds(output);
    const occupied = getOccupiedCells(output);
    const lowerStart = bounds.top + Math.floor(bounds.height * 0.7);
    const rightStart = bounds.left + Math.floor(bounds.width * 0.55);

    expect(runtimeCamera).toEqual(recipe.camera);
    expect(bounds).toMatchObject({ height: 27, width: 37 });
    expect(occupied.some(({ column, row }) => row < lowerStart && column >= rightStart)).toBe(true);
    expect(occupied.some(({ column, row }) => row >= lowerStart && column >= rightStart)).toBe(false);
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      expect(occupied.some((cell) => cell.row === row && cell.column < rightStart)).toBe(true);
    }
  });

  test("rejects recipes that render entirely outside the viewport", () => {
    const base = createPrelogEngineRecipe();
    const recipe = glyphRecipeSchema.parse({
      ...base,
      parts: [{
        ...base.parts[0],
        position: [1_000_000, 1_000_000, 1_000_000],
      }],
    });

    expect(() => renderGlyphRecipe(recipe, "thumbnail")).toThrowError(
      'Glyph recipe rendered no visible cells for preset "thumbnail".',
    );
  });

  test("renders varied article structures deterministically across every preset", () => {
    const presets = ["thumbnail", "feature", "social"] as const;
    const variants = Array.from({ length: 16 }, (_, variant) => {
      const sections = Array.from({ length: variant % 8 + 1 }, (_, index) => ({
        charCount: (variant + 1) * (index + 1) * 37,
        codeBlockCount: (variant + index) % 4,
        h3Count: (variant * 2 + index) % 5,
        imageCount: (variant + index * 2) % 3,
        listCount: (variant * 3 + index) % 4,
        quoteCount: (variant + index) % 2,
        title: `Section ${variant + 1}-${index + 1}`,
      }));
      const totals = sections.reduce((result, section) => ({
        charCount: result.charCount + section.charCount,
        codeBlocks: result.codeBlocks + section.codeBlockCount,
        headings: result.headings + section.h3Count + 1,
        images: result.images + section.imageCount,
        lists: result.lists + section.listCount,
        quotes: result.quotes + section.quoteCount,
      }), { charCount: 0, codeBlocks: 0, headings: 0, images: 0, lists: 0, quotes: 0 });
      return { sections, totals } satisfies ArticleGlyphSignals;
    });

    variants.forEach((signals, variant) => {
      const recipe = createArticleGlyphRecipe({
        category: variant % 2 === 0 ? "Engineering" : null,
        labels: {
          category: variant % 2 === 0 ? "Engineering" : null,
          tags: [`Tag ${variant % 3}`, `Tag ${variant % 5}`],
        },
        postId: `post-${variant}`,
        signals,
        tags: [`tag-${variant % 3}`, `tag-${variant % 5}`],
        title: `Article ${variant}`,
      });

      presets.forEach((preset) => {
        const first = renderGlyphRecipe(recipe, preset);
        const bounds = getOccupiedBounds(first);
        expect(renderGlyphRecipe(recipe, preset)).toBe(first);
        expect(first.replace(/\s/g, "").length).toBeGreaterThan(0);
        expect(bounds.left).toBeGreaterThan(0);
        expect(bounds.right).toBeLessThan(RENDER_GRID[preset].cols - 1);
        expect(bounds.top).toBeGreaterThan(0);
        expect(bounds.bottom).toBeLessThan(RENDER_GRID[preset].rows - 1);
      });
    });
  });

  test.each(Array.from(TITLE_GLYPH_CHARACTERS))("renders a contained %s title initial in every preset", (initial) => {
    const recipe = createArticleGlyphRecipe({
      category: null,
      labels: { category: null, tags: [] },
      postId: `post-${initial}`,
      signals: createArticleGlyphSignals("## Body\n\nText"),
      tags: [],
      title: `${initial} title`,
    });

    (["thumbnail", "feature", "social"] as const).forEach((preset) => {
      const output = renderGlyphRecipe(recipe, preset);
      const bounds = getOccupiedBounds(output);
      expect(new Set(output.replace(/\s/g, ""))).toEqual(new Set([initial]));
      expect(bounds.left).toBeGreaterThan(0);
      expect(bounds.right).toBeLessThan(RENDER_GRID[preset].cols - 1);
      expect(bounds.top).toBeGreaterThan(0);
      expect(bounds.bottom).toBeLessThan(RENDER_GRID[preset].rows - 1);
    });
  });
});

function getOccupiedBounds(output: string) {
  const occupied = getOccupiedCells(output);
  const columns = occupied.map(({ column }) => column);
  const rows = occupied.map(({ row }) => row);
  return {
    bottom: Math.max(...rows),
    height: Math.max(...rows) - Math.min(...rows) + 1,
    left: Math.min(...columns),
    right: Math.max(...columns),
    top: Math.min(...rows),
    width: Math.max(...columns) - Math.min(...columns) + 1,
  };
}

function getOccupiedCells(output: string) {
  return output.split("\n").flatMap((line, row) =>
    Array.from(line, (character, column) => ({ character, column, row }))
      .filter(({ character }) => character !== " "),
  );
}

const RENDER_GRID = {
  feature: { cols: 80, rows: 40 },
  social: { cols: 80, rows: 40 },
  thumbnail: { cols: 28, rows: 14 },
} as const;
