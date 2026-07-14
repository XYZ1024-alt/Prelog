import { spawnSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { requireTestDatabaseUrl } from "./test-env.ts";
import { seedTestData } from "./seed-test-data.ts";

const PRISMA_CLI = "node_modules/prisma/build/index.js";

async function main() {
  const databaseUrl = requireTestDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  runMigrations(databaseUrl);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await clearDatabase(prisma);
    await seedTestData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

function runMigrations(databaseUrl: string) {
  const result = spawnSync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(result.error?.message ?? "Failed to apply migrations to DATABASE_URL_TEST.");
  }
}

async function clearDatabase(prisma: PrismaClient) {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.analyticsDailyMetric.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.friendLink.deleteMany();
  await prisma.postTag.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.siteSettings.deleteMany();
  await prisma.user.deleteMany();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
