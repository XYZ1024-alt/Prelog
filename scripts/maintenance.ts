import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

const HELP_FLAGS = new Set(["--help", "-h"]);
const ANALYTICS_RETENTION_DAYS = 400;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 1 && HELP_FLAGS.has(args[0])) {
    printHelp();
    return;
  }

  if (args.length > 0) {
    throw new Error(`Unknown arguments: ${args.join(" ")}. Use --help for usage.`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getRequiredDatabaseUrl() }),
  });

  try {
    await runMaintenance(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

function printHelp() {
  console.log(`Usage: node maintenance.mjs

Scrubs rollback-only request-level data and expires analytics aggregates older
than ${ANALYTICS_RETENTION_DAYS} days, expired rate-limit buckets, and expired
post preview tokens. DATABASE_URL is required.`);
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

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run maintenance.");
  }

  return databaseUrl;
}

main().catch((error) => {
  console.error("Maintenance failed.", error);
  process.exitCode = 1;
});
