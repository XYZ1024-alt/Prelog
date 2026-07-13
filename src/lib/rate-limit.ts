import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RateLimitDatabase = Pick<typeof prisma, "$queryRaw">;

export type RateLimitPolicy = {
  readonly limit: number;
  readonly windowMs: number;
};

type ConsumeRateLimitOptions = RateLimitPolicy & {
  readonly database?: RateLimitDatabase;
  readonly key: string;
  readonly now?: Date;
};

export type RateLimitResult = {
  readonly allowed: boolean;
  readonly count: number;
  readonly limit: number;
  readonly resetAt: Date;
  readonly retryAfterSeconds: number;
};

type RateLimitRow = {
  readonly count: number;
  readonly expiresAt: Date;
};

const MILLISECONDS_PER_SECOND = 1000;
const EXPIRED_BUCKET_PRUNE_LIMIT = 32;

export async function consumeRateLimit(options: ConsumeRateLimitOptions): Promise<RateLimitResult> {
  validateOptions(options);
  const database = options.database ?? prisma;
  const now = options.now ?? new Date();
  const nextExpiry = new Date(now.getTime() + options.windowMs);
  const maximumStoredCount = options.limit + 1;
  const rows = await database.$queryRaw<RateLimitRow[]>(Prisma.sql`
    WITH expired_buckets AS (
      SELECT "key"
      FROM "RateLimitBucket"
      WHERE "expiresAt" <= ${now}
        AND "key" <> ${options.key}
      ORDER BY "expiresAt" ASC
      LIMIT ${EXPIRED_BUCKET_PRUNE_LIMIT}
      FOR UPDATE SKIP LOCKED
    ), pruned_buckets AS (
      DELETE FROM "RateLimitBucket" AS expired
      USING expired_buckets
      WHERE expired."key" = expired_buckets."key"
    )
    INSERT INTO "RateLimitBucket" AS bucket
      ("key", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES
      (${options.key}, 1, ${nextExpiry}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN bucket."expiresAt" <= ${now} THEN 1
        ELSE LEAST(bucket."count" + 1, ${maximumStoredCount})
      END,
      "expiresAt" = CASE
        WHEN bucket."expiresAt" <= ${now} THEN ${nextExpiry}
        ELSE bucket."expiresAt"
      END,
      "createdAt" = CASE
        WHEN bucket."expiresAt" <= ${now} THEN ${now}
        ELSE bucket."createdAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "expiresAt"
  `);
  const bucket = rows[0];

  if (!bucket) {
    throw new Error(`Rate limit bucket ${options.key} did not return a row.`);
  }

  return createResult(bucket, options.limit, now);
}

function createResult(bucket: RateLimitRow, limit: number, now: Date): RateLimitResult {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_SECOND),
  );

  return {
    allowed: bucket.count <= limit,
    count: bucket.count,
    limit,
    resetAt: bucket.expiresAt,
    retryAfterSeconds,
  };
}

function validateOptions(options: ConsumeRateLimitOptions) {
  if (!options.key.trim()) {
    throw new TypeError("Rate limit key must not be empty.");
  }

  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new TypeError("Rate limit must be a positive safe integer.");
  }

  if (!Number.isSafeInteger(options.windowMs) || options.windowMs < 1) {
    throw new TypeError("Rate limit window must be a positive safe integer.");
  }
}
