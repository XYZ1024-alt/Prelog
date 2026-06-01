import { afterAll } from "vitest";

import { requireTestDatabaseUrl } from "../helpers/test-env.ts";

process.env.DATABASE_URL = requireTestDatabaseUrl();

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
