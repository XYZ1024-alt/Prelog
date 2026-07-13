import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.ts";
import {
  createArticleGlyphRecipe,
  createArticleGlyphSignals,
  glyphRecipeSchema,
} from "../src/lib/glyph-recipe.ts";
import { isAllowedManualCoverUrl } from "../src/lib/validation.ts";

type BackfillStats = {
  failed: number;
  invalidManual: number;
  manualScanned: number;
  scanned: number;
  selected: number;
  updated: number;
};

const HELP_FLAGS = new Set(["--help", "-h"]);
const PREFLIGHT_FLAG = "--preflight";
const MAINTENANCE_FLAG = "--maintenance";
const ANALYTICS_RETENTION_DAYS = 400;
const stats: BackfillStats = {
  failed: 0,
  invalidManual: 0,
  manualScanned: 0,
  scanned: 0,
  selected: 0,
  updated: 0,
};
const GLYPH_BACKFILL_SELECT = {
  category: { select: { name: true, slug: true } },
  content: true,
  glyphRecipe: true,
  glyphSourceHash: true,
  id: true,
  slug: true,
  tags: { select: { tag: { select: { name: true, slug: true } } } },
  title: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

type GlyphBackfillPost = Prisma.PostGetPayload<{ select: typeof GLYPH_BACKFILL_SELECT }>;

async function main() {
  const command = parseCommandLine(process.argv.slice(2));

  if (command === "help") {
    printHelp();
    return;
  }

  const databaseUrl = getRequiredDatabaseUrl();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    if (command === "preflight") {
      await preflightLegacyPosts(prisma);
    } else if (command === "maintenance") {
      await runMaintenance(prisma);
    } else {
      await auditManualCovers(prisma);
      await backfillGlyphRecipes(prisma);
    }
  } finally {
    if (command === "run") {
      console.log(
        `Cover audit: manualScanned=${stats.manualScanned}, invalidManual=${stats.invalidManual}; Glyph backfill: scanned=${stats.scanned}, selected=${stats.selected}, updated=${stats.updated}, failed=${stats.failed}`,
      );
    }
    await prisma.$disconnect();
  }
}

function parseCommandLine(args: readonly string[]) {
  if (args.length === 0) {
    return "run" as const;
  }

  if (args.length === 1 && HELP_FLAGS.has(args[0])) {
    return "help" as const;
  }

  if (args.length === 1 && args[0] === PREFLIGHT_FLAG) {
    return "preflight" as const;
  }

  if (args.length === 1 && args[0] === MAINTENANCE_FLAG) {
    return "maintenance" as const;
  }

  throw new Error(`Unknown arguments: ${args.join(" ")}. Use --help for usage.`);
}

function printHelp() {
  console.log(`Usage: node backfill-glyph-recipes.mjs [--preflight | --maintenance]

Idempotently creates locked Glyph recipes for published GLYPH posts that do
not have a valid recipe and source hash. Before writing, it rejects any MANUAL
post whose cover is not an allowed public HTTPS URL. --preflight audits legacy
posts without requiring new columns. --maintenance scrubs rollback-only request
data and expires old aggregates, tokens, and buckets. DATABASE_URL is required.`);
}

async function preflightLegacyPosts(prisma: PrismaClient) {
  const [databaseState] = await prisma.$queryRaw<Array<{ postTable: string | null }>>`
    SELECT to_regclass('"Post"')::text AS "postTable"
  `;

  if (!databaseState?.postTable) {
    console.log("Preflight passed: fresh database has no legacy Post table.");
    return;
  }

  const posts = await prisma.$queryRaw<Array<{
    content: string;
    coverImage: string | null;
    id: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED";
    title: string;
  }>>`
    SELECT "id", "slug", "title", "content", "coverImage", "status"
    FROM "Post"
    ORDER BY "id" ASC
  `;
  const manual = posts.filter((post) => post.coverImage?.trim());
  const invalid = manual.filter((post) => !isAllowedManualCoverUrl(post.coverImage ?? ""));
  const glyphCandidates = posts.filter((post) => !post.coverImage?.trim() && post.status === "PUBLISHED");

  invalid.forEach((post) => console.error(`Invalid legacy cover: ${post.slug} (${post.id})`));
  if (invalid.length > 0) {
    throw new Error(`${invalid.length} legacy cover(s) must be repaired before migration.`);
  }

  glyphCandidates.forEach((post) => {
    createArticleGlyphRecipe({
      category: null,
      labels: { category: null, tags: [] },
      postId: post.id,
      signals: createArticleGlyphSignals(post.content),
      tags: [],
      title: post.title,
    });
  });
  console.log(`Preflight passed: posts=${posts.length}, manual=${manual.length}, glyphCandidates=${glyphCandidates.length}`);
}

async function runMaintenance(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    DO $maintenance$
    BEGIN
      IF to_regclass('"PageView"') IS NOT NULL THEN
        DELETE FROM "PageView";
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'userAgent'
      ) THEN
        UPDATE "Comment" SET "userAgent" = NULL WHERE "userAgent" IS NOT NULL;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'ipHash'
      ) THEN
        UPDATE "Comment" SET "ipHash" = NULL WHERE "ipHash" IS NOT NULL;
      END IF;
    END
    $maintenance$;
  `);
  const expiredMetrics = await prisma.$executeRaw`
    DELETE FROM "AnalyticsDailyMetric"
    WHERE "date" < CURRENT_TIMESTAMP - (${ANALYTICS_RETENTION_DAYS} * INTERVAL '1 day')
  `;
  const expiredBuckets = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const expiredTokens = await prisma.postPreviewToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log(
    `Maintenance complete: metrics=${expiredMetrics}, buckets=${expiredBuckets.count}, previewTokens=${expiredTokens.count}`,
  );
}

async function auditManualCovers(prisma: PrismaClient) {
  const posts = await prisma.post.findMany({
    where: { coverMode: "MANUAL" },
    orderBy: { id: "asc" },
    select: { coverImage: true, id: true, slug: true, status: true },
  });
  const invalid = posts.filter((post) => !post.coverImage || !isAllowedManualCoverUrl(post.coverImage));
  stats.manualScanned = posts.length;
  stats.invalidManual = invalid.length;

  if (invalid.length === 0) {
    return;
  }

  invalid.forEach((post) => {
    console.error(`Invalid MANUAL cover: ${post.slug} (${post.id}, ${post.status})`);
  });
  throw new Error(`${invalid.length} MANUAL post(s) must be repaired before deployment.`);
}

async function backfillGlyphRecipes(prisma: PrismaClient) {
  const posts = await prisma.post.findMany({
    where: {
      coverMode: "GLYPH",
      status: "PUBLISHED",
    },
    orderBy: { id: "asc" },
    select: GLYPH_BACKFILL_SELECT,
  });
  const candidates = posts.filter(needsGlyphRecipeBackfill);
  stats.scanned = posts.length;
  stats.selected = candidates.length;

  for (const post of candidates) {
    await backfillGlyphRecipe(prisma, post);
  }
}

function needsGlyphRecipeBackfill(post: GlyphBackfillPost) {
  const recipe = glyphRecipeSchema.safeParse(post.glyphRecipe);
  return !recipe.success || !post.glyphSourceHash || post.glyphSourceHash !== recipe.data.sourceHash;
}

async function backfillGlyphRecipe(prisma: PrismaClient, post: GlyphBackfillPost) {
  try {
    const signals = createArticleGlyphSignals(post.content);
    const recipe = createArticleGlyphRecipe({
      category: post.category?.slug ?? null,
      labels: {
        category: post.category?.name ?? null,
        tags: post.tags.map(({ tag }) => tag.name),
      },
      postId: post.id,
      signals,
      tags: post.tags.map(({ tag }) => tag.slug).sort(),
      title: post.title,
    });
    const result = await prisma.post.updateMany({
      where: {
        coverMode: "GLYPH",
        glyphSourceHash: post.glyphSourceHash,
        id: post.id,
        status: "PUBLISHED",
        updatedAt: post.updatedAt,
      },
      data: {
        glyphGeneratedAt: new Date(),
        glyphRecipe: recipe,
        glyphSourceHash: recipe.sourceHash,
        updatedAt: post.updatedAt,
      },
    });

    if (result.count !== 1) {
      throw new Error(`Post ${post.id} is no longer eligible for glyph recipe backfill.`);
    }

    stats.updated += 1;
    console.log(`Backfilled ${post.slug}: ${recipe.sourceHash}`);
  } catch (error) {
    stats.failed += 1;
    console.error(`Failed to backfill glyph recipe for ${post.slug} (${post.id}).`);
    throw error;
  }
}

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to backfill glyph recipes.");
  }

  return databaseUrl;
}

main().catch((error) => {
  console.error("Glyph recipe backfill failed.", error);
  process.exitCode = 1;
});
