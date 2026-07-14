import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { AnalyticsMetricType } from "@/generated/prisma/enums";
import type { z } from "zod";

import { PUBLIC_ADMIN_PATH } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, type RateLimitPolicy } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { getSiteUrl } from "@/lib/site-url";
import { analyticsSchema } from "@/lib/validation";

export const ANALYTICS_RATE_LIMIT_POLICY = {
  limit: 80,
  windowMs: 60 * 1000,
} as const satisfies RateLimitPolicy;
export const ANALYTICS_ATTEMPT_RATE_LIMIT_POLICY = {
  limit: 120,
  windowMs: 60 * 1000,
} as const satisfies RateLimitPolicy;
export const ANALYTICS_GLOBAL_RATE_LIMIT_POLICY = {
  limit: 50_000,
  windowMs: 24 * 60 * 60 * 1000,
} as const satisfies RateLimitPolicy;
export const ANALYTICS_SEARCH_RATE_LIMIT_POLICY = {
  limit: 2_000,
  windowMs: 24 * 60 * 60 * 1000,
} as const satisfies RateLimitPolicy;
export const ANALYTICS_REFERRER_DAILY_DISTINCT_LIMIT = 64;
export const ANALYTICS_REFERRER_OVERFLOW_DIMENSION = "(other)";

type AnalyticsEvent = z.infer<typeof analyticsSchema>;
type AnalyticsDatabase = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw" | "analyticsDailyMetric"
>;

type DailyMetric = {
  readonly date: Date;
  readonly dimension: string;
  readonly path: string;
  readonly type: AnalyticsMetricType;
};

type ReferrerCardinality = {
  readonly distinctCount: number;
  readonly knownDimension: boolean;
};

class AnalyticsRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Analytics rate limit exceeded.");
    this.name = "AnalyticsRateLimitError";
  }
}

const AUTOMATED_USER_AGENT_PATTERN = /bot|crawler|spider|headless|lighthouse|preview|facebookexternalhit|slurp/i;
const PRIVATE_PATH_PREFIXES = Array.from(new Set([PUBLIC_ADMIN_PATH, "/admin", "/api", "/preview"]));
const STATIC_PUBLIC_PATHS = new Set(["/", "/about", "/archive", "/categories", "/friends", "/search", "/tags"]);
const DYNAMIC_PUBLIC_PATH_PATTERN = /^\/(posts|categories|tags)\/([^/]+)$/;
const MAX_PUBLIC_SLUG_LENGTH = 140;
const ANALYTICS_RETENTION_DAYS = 400;
const ANALYTICS_PRUNE_LIMIT = 64;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ignoredReason = getIgnoredReason(request.headers);

  if (ignoredReason) {
    return NextResponse.json({ ok: true, reason: ignoredReason, recorded: false }, { status: 202 });
  }

  const siteOrigin = getSiteUrl().origin;

  if (!hasValidOrigin(request.headers, siteOrigin)) {
    return NextResponse.json({ error: "Analytics origin is not allowed." }, { status: 403 });
  }

  const identity = getRequestIdentity(request.headers, "analytics");
  const attemptLimit = await consumeRateLimit({
    ...ANALYTICS_ATTEMPT_RATE_LIMIT_POLICY,
    key: `analytics:attempt:${identity.hash}`,
  });

  if (!attemptLimit.allowed) {
    return createRateLimitResponse(attemptLimit.retryAfterSeconds);
  }

  const payload = await readPayload(request);
  const parsed = analyticsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  if (isPrivatePath(parsed.data.path)) {
    return NextResponse.json({ error: "Private paths cannot be recorded." }, { status: 400 });
  }

  const now = new Date();

  if (!(await isPublicAnalyticsEvent(parsed.data))) {
    return NextResponse.json({ error: "Analytics path is not a published public route." }, { status: 400 });
  }

  try {
    await recordAcceptedEvent({
      event: parsed.data,
      identityHash: identity.hash,
      now,
      siteOrigin,
    });
  } catch (error) {
    if (error instanceof AnalyticsRateLimitError) {
      return createRateLimitResponse(error.retryAfterSeconds);
    }

    throw error;
  }

  return NextResponse.json({ ok: true, recorded: true });
}

type RecordAcceptedEventOptions = {
  readonly event: AnalyticsEvent;
  readonly identityHash: string;
  readonly now: Date;
  readonly siteOrigin: string;
};

async function recordAcceptedEvent(options: RecordAcceptedEventOptions) {
  await prisma.$transaction(async (database) => {
    await consumeAcceptedEventQuotas(database, options);
    const metrics = await createDailyMetrics(database, options.event, options.siteOrigin, options.now);

    for (const metric of metrics) {
      await incrementDailyMetric(database, metric);
    }

    await pruneExpiredAnalytics(database, options.now);
  });
}

async function consumeAcceptedEventQuotas(
  database: AnalyticsDatabase,
  options: Pick<RecordAcceptedEventOptions, "event" | "identityHash" | "now">,
) {
  const quotas = createAcceptedEventQuotas(options);

  for (const quota of quotas) {
    const result = await consumeRateLimit({ ...quota, database, now: options.now });

    if (!result.allowed) {
      throw new AnalyticsRateLimitError(result.retryAfterSeconds);
    }
  }
}

function createAcceptedEventQuotas(
  options: Pick<RecordAcceptedEventOptions, "event" | "identityHash" | "now">,
) {
  const day = formatUtcDay(options.now);
  const quotas: Array<RateLimitPolicy & { readonly key: string }> = [{
    ...ANALYTICS_RATE_LIMIT_POLICY,
    key: `analytics:${options.identityHash}`,
  }];

  if (options.event.type === "SEARCH" || options.event.type === "SEARCH_ZERO") {
    quotas.push({
      ...ANALYTICS_SEARCH_RATE_LIMIT_POLICY,
      key: `analytics:search:${day}`,
    });
  }

  quotas.push({
    ...ANALYTICS_GLOBAL_RATE_LIMIT_POLICY,
    key: `analytics:global:${day}`,
  });
  return quotas;
}

function createRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Analytics rate limit exceeded." },
    { headers: { "Retry-After": String(retryAfterSeconds) }, status: 429 },
  );
}

function incrementDailyMetric(database: AnalyticsDatabase, metric: DailyMetric) {
  const identity = {
    date: metric.date,
    dimension: metric.dimension,
    path: metric.path,
    type: metric.type,
  };

  return database.analyticsDailyMetric.upsert({
    create: { ...identity, count: 1 },
    update: { count: { increment: 1 } },
    where: { date_type_path_dimension: identity },
  });
}

function pruneExpiredAnalytics(database: AnalyticsDatabase, now: Date) {
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * DAY_MS);

  return database.$executeRaw`
    WITH expired_metrics AS (
      SELECT "date", "type", "path", "dimension"
      FROM "AnalyticsDailyMetric"
      WHERE "date" < ${cutoff}
      ORDER BY "date" ASC
      LIMIT ${ANALYTICS_PRUNE_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "AnalyticsDailyMetric" AS metric
    USING expired_metrics
    WHERE metric."date" = expired_metrics."date"
      AND metric."type" = expired_metrics."type"
      AND metric."path" = expired_metrics."path"
      AND metric."dimension" = expired_metrics."dimension"
  `;
}

async function isPublicAnalyticsEvent(event: AnalyticsEvent) {
  if (event.type === "SEARCH" || event.type === "SEARCH_ZERO") {
    return event.path === "/search";
  }

  if (event.type === "READ_DEPTH") {
    return await isPublishedDynamicPath(event.path, "posts");
  }

  return isPublicAnalyticsPath(event.path);
}

async function isPublicAnalyticsPath(path: string) {
  if (STATIC_PUBLIC_PATHS.has(path)) {
    return true;
  }

  const match = DYNAMIC_PUBLIC_PATH_PATTERN.exec(path);

  if (!match) {
    return false;
  }

  return await isPublishedDynamicPath(path, match[1] as "categories" | "posts" | "tags");
}

async function isPublishedDynamicPath(path: string, expectedType: "categories" | "posts" | "tags") {
  const match = DYNAMIC_PUBLIC_PATH_PATTERN.exec(path);

  if (!match || match[1] !== expectedType) {
    return false;
  }

  const slug = decodePublicSlug(match[2]);

  if (!slug) {
    return false;
  }

  if (expectedType === "posts") {
    return await prisma.post.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } }) !== null;
  }

  if (expectedType === "categories") {
    return await prisma.category.findFirst({
      where: { slug, posts: { some: { status: "PUBLISHED" } } },
      select: { id: true },
    }) !== null;
  }

  return await prisma.tag.findFirst({
    where: { slug, posts: { some: { post: { status: "PUBLISHED" } } } },
    select: { id: true },
  }) !== null;
}

function decodePublicSlug(value: string | undefined) {
  try {
    const slug = decodeURIComponent(value ?? "");
    return slug && slug.length <= MAX_PUBLIC_SLUG_LENGTH ? slug : null;
  } catch {
    return null;
  }
}

async function createDailyMetrics(
  database: AnalyticsDatabase,
  event: AnalyticsEvent,
  siteOrigin: string,
  now: Date,
): Promise<DailyMetric[]> {
  const date = startOfUtcDay(now);
  const base = { date, path: event.path };

  if (event.type === "READ_DEPTH") {
    return [{ ...base, dimension: event.depth, type: "READ_DEPTH" }];
  }

  if (event.type === "SEARCH" || event.type === "SEARCH_ZERO") {
    // Search text is retained only as a bounded daily aggregate dimension; no request identity is stored.
    return [{ ...base, dimension: event.query, type: event.type }];
  }

  const metrics: DailyMetric[] = [{ ...base, dimension: "", type: "PAGE_VIEW" }];
  const referrerHost = getExternalReferrerHost(event.referrer, siteOrigin);

  if (referrerHost) {
    const dimension = await resolveReferrerDimension(database, date, referrerHost);
    metrics.push({ ...base, dimension, type: "REFERRER" });
  }

  return metrics;
}

async function resolveReferrerDimension(
  database: AnalyticsDatabase,
  date: Date,
  requestedDimension: string,
) {
  const lockKey = `analytics:referrer-cardinality:${formatUtcDay(date)}`;
  await database.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))
  `;
  const [cardinality] = await database.$queryRaw<ReferrerCardinality[]>`
    SELECT
      EXISTS (
        SELECT 1
        FROM "AnalyticsDailyMetric"
        WHERE "date" = ${date}
          AND "type" = 'REFERRER'::"AnalyticsMetricType"
          AND "dimension" = ${requestedDimension}
      ) AS "knownDimension",
      COUNT(DISTINCT "dimension") FILTER (
        WHERE "dimension" <> ${ANALYTICS_REFERRER_OVERFLOW_DIMENSION}
      )::integer AS "distinctCount"
    FROM "AnalyticsDailyMetric"
    WHERE "date" = ${date}
      AND "type" = 'REFERRER'::"AnalyticsMetricType"
  `;

  if (!cardinality) {
    throw new Error("Referrer cardinality query did not return a row.");
  }

  if (cardinality.knownDimension
    || cardinality.distinctCount < ANALYTICS_REFERRER_DAILY_DISTINCT_LIMIT) {
    return requestedDimension;
  }

  return ANALYTICS_REFERRER_OVERFLOW_DIMENSION;
}

function getExternalReferrerHost(value: string | undefined, siteOrigin: string) {
  if (!value) {
    return null;
  }

  const referrer = new URL(value);
  return referrer.origin === siteOrigin ? null : referrer.hostname.toLowerCase();
}

function hasValidOrigin(headers: Headers, siteOrigin: string) {
  const origin = headers.get("origin");
  const fetchSite = headers.get("sec-fetch-site");

  if (!origin || fetchSite === "cross-site") {
    return false;
  }

  try {
    return new URL(origin).origin === siteOrigin;
  } catch {
    return false;
  }
}

function getIgnoredReason(headers: Headers) {
  const userAgent = headers.get("user-agent");

  if (!userAgent || AUTOMATED_USER_AGENT_PATTERN.test(userAgent)) {
    return "automated-client";
  }

  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") {
    return "privacy-preference";
  }

  if (headers.get("purpose") === "prefetch" || headers.has("next-router-prefetch")) {
    return "prefetch";
  }

  return null;
}

function isPrivatePath(path: string) {
  return PRIVATE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

async function readPayload(request: NextRequest) {
  try {
    return await request.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatUtcDay(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}
