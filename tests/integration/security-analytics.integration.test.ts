import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
  POST as analyticsPOST,
  ANALYTICS_ATTEMPT_RATE_LIMIT_POLICY,
  ANALYTICS_GLOBAL_RATE_LIMIT_POLICY,
  ANALYTICS_RATE_LIMIT_POLICY,
  ANALYTICS_REFERRER_DAILY_DISTINCT_LIMIT,
  ANALYTICS_REFERRER_OVERFLOW_DIMENSION,
  ANALYTICS_SEARCH_RATE_LIMIT_POLICY,
} from "@/app/api/analytics/route";
import { POST as authPOST } from "@/app/api/auth/[...nextauth]/route";
import { LOGIN_RATE_LIMIT_POLICIES } from "@/lib/auth";
import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { TEST_POSTS } from "../helpers/seed-test-data.ts";

const SITE_ORIGIN = "http://127.0.0.1:3000";
const TEST_AUTH_SECRET = "integration-request-identity-secret";
const ANALYTICS_POST_PATH = `/posts/${TEST_POSTS.published.slug}`;

beforeAll(() => {
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  process.env.NEXTAUTH_URL = SITE_ORIGIN;
  process.env.TRUST_PROXY_HEADERS = "false";
  delete process.env.VERCEL;
});

beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.analyticsDailyMetric.deleteMany();
});

describe("database rate limiting", () => {
  test("atomically consumes a fixed window and resets after expiry", async () => {
    const now = new Date("2026-07-13T08:00:00.000Z");
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => consumeRateLimit({
        key: "integration:atomic-window",
        limit: 3,
        now,
        windowMs: 60_000,
      })),
    );

    expect(attempts.filter((attempt) => attempt.allowed)).toHaveLength(3);
    expect(attempts.map((attempt) => attempt.count).sort((left, right) => left - right))
      .toEqual([1, 2, 3, 4, 4]);

    const reset = await consumeRateLimit({
      key: "integration:atomic-window",
      limit: 3,
      now: new Date(now.getTime() + 60_001),
      windowMs: 60_000,
    });

    expect(reset).toMatchObject({ allowed: true, count: 1 });
  });

  test("prunes expired buckets while preserving the active key", async () => {
    const now = new Date("2026-07-13T08:00:00.000Z");
    await prisma.rateLimitBucket.createMany({
      data: Array.from({ length: 40 }, (_, index) => ({
        count: 1,
        expiresAt: new Date(now.getTime() - index - 1),
        key: `expired:${index}`,
      })),
    });

    await consumeRateLimit({
      key: "active",
      limit: 3,
      now,
      windowMs: 60_000,
    });

    expect(await prisma.rateLimitBucket.count({
      where: { expiresAt: { lte: now } },
    })).toBe(40 - 32);
    expect(await prisma.rateLimitBucket.findUnique({ where: { key: "active" } }))
      .toMatchObject({ count: 1 });
  });
});

describe("privacy-preserving analytics", () => {
  test("scrubs request-level analytics and comment fingerprints while retaining rollback columns", async () => {
    const [legacy] = await prisma.$queryRaw<Array<{
      pageViews: bigint;
      commentsWithFingerprint: bigint;
    }>>`
      SELECT
        (SELECT COUNT(*) FROM "PageView") AS "pageViews",
        (SELECT COUNT(*) FROM "Comment" WHERE "ipHash" IS NOT NULL OR "userAgent" IS NOT NULL)
          AS "commentsWithFingerprint"
    `;

    expect(legacy).toEqual({ commentsWithFingerprint: 0n, pageViews: 0n });
  });

  test("aggregates page, referrer, read-depth, and search events without request-level records", async () => {
    const pageResponse = await analyticsPOST(createAnalyticsRequest({
      path: ANALYTICS_POST_PATH,
      referrer: "https://news.example/private/path?q=secret",
      type: "PAGE_VIEW",
    }));
    const repeatedPageResponse = await analyticsPOST(createAnalyticsRequest({
      path: ANALYTICS_POST_PATH,
      referrer: "https://news.example/another/private/path",
      type: "PAGE_VIEW",
    }));
    const depthResponse = await analyticsPOST(createAnalyticsRequest({
      depth: "50",
      path: ANALYTICS_POST_PATH,
      type: "READ_DEPTH",
    }));
    const searchResponse = await analyticsPOST(createAnalyticsRequest({
      path: "/search",
      query: "  Missing   Topic  ",
      type: "SEARCH_ZERO",
    }));
    const friendsResponse = await analyticsPOST(createAnalyticsRequest({
      path: "/friends",
      type: "PAGE_VIEW",
    }));

    expect([
      pageResponse.status,
      repeatedPageResponse.status,
      depthResponse.status,
      searchResponse.status,
      friendsResponse.status,
    ]).toEqual([200, 200, 200, 200, 200]);
    const metrics = await prisma.analyticsDailyMetric.findMany({
      orderBy: [{ type: "asc" }, { dimension: "asc" }],
      select: { count: true, dimension: true, path: true, type: true },
    });

    expect(metrics).toEqual(expect.arrayContaining([
      { count: 2, dimension: "", path: ANALYTICS_POST_PATH, type: "PAGE_VIEW" },
      { count: 2, dimension: "news.example", path: ANALYTICS_POST_PATH, type: "REFERRER" },
      { count: 1, dimension: "50", path: ANALYTICS_POST_PATH, type: "READ_DEPTH" },
      { count: 1, dimension: "missing topic", path: "/search", type: "SEARCH_ZERO" },
      { count: 1, dimension: "", path: "/friends", type: "PAGE_VIEW" },
    ]));
  });

  test("rolls back identity and global quotas when the search quota rejects an event", async () => {
    const request = createAnalyticsRequest({
      path: "/search",
      query: "quota test",
      type: "SEARCH",
    });
    const day = new Date().toISOString().slice(0, 10);
    const identity = getRequestIdentity(request.headers, "analytics");
    await createExhaustedBucket(
      `analytics:search:${day}`,
      ANALYTICS_SEARCH_RATE_LIMIT_POLICY.limit,
      ANALYTICS_SEARCH_RATE_LIMIT_POLICY.windowMs,
    );

    const response = await analyticsPOST(request);

    expect(response.status).toBe(429);
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:${identity.hash}` },
    })).toBeNull();
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:global:${day}` },
    })).toBeNull();
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:search:${day}` },
    })).toMatchObject({ count: ANALYTICS_SEARCH_RATE_LIMIT_POLICY.limit });
    expect(await prisma.analyticsDailyMetric.count()).toBe(0);
  });

  test("rolls back identity and search quotas when the global quota rejects an event", async () => {
    const request = createAnalyticsRequest({
      path: "/search",
      query: "global quota test",
      type: "SEARCH_ZERO",
    });
    const day = new Date().toISOString().slice(0, 10);
    const identity = getRequestIdentity(request.headers, "analytics");
    await createExhaustedBucket(
      `analytics:global:${day}`,
      ANALYTICS_GLOBAL_RATE_LIMIT_POLICY.limit,
      ANALYTICS_GLOBAL_RATE_LIMIT_POLICY.windowMs,
    );

    const response = await analyticsPOST(request);

    expect(response.status).toBe(429);
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:${identity.hash}` },
    })).toBeNull();
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:search:${day}` },
    })).toBeNull();
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:global:${day}` },
    })).toMatchObject({ count: ANALYTICS_GLOBAL_RATE_LIMIT_POLICY.limit });
    expect(await prisma.analyticsDailyMetric.count()).toBe(0);
  });

  test("aggregates new referrer hosts into a stable overflow dimension at the daily cap", async () => {
    const today = startOfUtcDay(new Date());
    await prisma.analyticsDailyMetric.createMany({
      data: Array.from({ length: ANALYTICS_REFERRER_DAILY_DISTINCT_LIMIT }, (_, index) => ({
        count: 1,
        date: today,
        dimension: `source-${index}.example`,
        path: ANALYTICS_POST_PATH,
        type: "REFERRER" as const,
      })),
    });

    const [firstOverflow, knownSource, repeatedOverflow] = await Promise.all([
      analyticsPOST(createAnalyticsRequest({
        path: ANALYTICS_POST_PATH,
        referrer: "https://new-source.example/private",
        type: "PAGE_VIEW",
      }, { address: "203.0.113.61" })),
      analyticsPOST(createAnalyticsRequest({
        path: ANALYTICS_POST_PATH,
        referrer: "https://source-0.example/another-private-path",
        type: "PAGE_VIEW",
      }, { address: "203.0.113.62" })),
      analyticsPOST(createAnalyticsRequest({
        path: ANALYTICS_POST_PATH,
        referrer: "https://another-new-source.example/private",
        type: "PAGE_VIEW",
      }, { address: "203.0.113.63" })),
    ]);

    expect([firstOverflow.status, knownSource.status, repeatedOverflow.status]).toEqual([200, 200, 200]);
    expect(await prisma.analyticsDailyMetric.count({
      where: {
        date: today,
        dimension: { not: ANALYTICS_REFERRER_OVERFLOW_DIMENSION },
        type: "REFERRER",
      },
    })).toBe(ANALYTICS_REFERRER_DAILY_DISTINCT_LIMIT);
    expect(await prisma.analyticsDailyMetric.findUnique({
      where: {
        date_type_path_dimension: {
          date: today,
          dimension: ANALYTICS_REFERRER_OVERFLOW_DIMENSION,
          path: ANALYTICS_POST_PATH,
          type: "REFERRER",
        },
      },
    })).toMatchObject({ count: 2 });
    expect(await prisma.analyticsDailyMetric.findUnique({
      where: {
        date_type_path_dimension: {
          date: today,
          dimension: "source-0.example",
          path: ANALYTICS_POST_PATH,
          type: "REFERRER",
        },
      },
    })).toMatchObject({ count: 2 });
  });

  test("does not write for bots or invalid origins", async () => {
    const botResponse = await analyticsPOST(createAnalyticsRequest(
      { path: "/", type: "PAGE_VIEW" },
      { userAgent: "Googlebot/2.1" },
    ));
    const invalidOriginResponse = await analyticsPOST(createAnalyticsRequest(
      { path: "/", type: "PAGE_VIEW" },
      { origin: "https://attacker.example" },
    ));
    const previewResponse = await analyticsPOST(createAnalyticsRequest({
      path: "/preview/bearer-token-value",
      type: "PAGE_VIEW",
    }));
    const unknownResponse = await analyticsPOST(createAnalyticsRequest({
      path: "/posts/not-published",
      type: "PAGE_VIEW",
    }));
    const misplacedSearchResponse = await analyticsPOST(createAnalyticsRequest({
      path: "/about",
      query: "topic",
      type: "SEARCH",
    }));
    const misplacedDepthResponse = await analyticsPOST(createAnalyticsRequest({
      depth: "50",
      path: "/search",
      type: "READ_DEPTH",
    }));

    expect(botResponse.status).toBe(202);
    expect(invalidOriginResponse.status).toBe(403);
    expect(previewResponse.status).toBe(400);
    expect(unknownResponse.status).toBe(400);
    expect(misplacedSearchResponse.status).toBe(400);
    expect(misplacedDepthResponse.status).toBe(400);
    expect(await prisma.analyticsDailyMetric.count()).toBe(0);
    expect(await prisma.rateLimitBucket.findUnique({
      where: { key: `analytics:global:${new Date().toISOString().slice(0, 10)}` },
    })).toBeNull();
  });

  test("prunes analytics outside the retention window", async () => {
    await prisma.analyticsDailyMetric.create({
      data: {
        count: 1,
        date: new Date("2020-01-01T00:00:00.000Z"),
        dimension: "",
        path: "/",
        type: "PAGE_VIEW",
      },
    });

    const response = await analyticsPOST(createAnalyticsRequest({ path: "/", type: "PAGE_VIEW" }));

    expect(response.status).toBe(200);
    expect(await prisma.analyticsDailyMetric.count({
      where: { date: new Date("2020-01-01T00:00:00.000Z") },
    })).toBe(0);
  });

  test("returns 429 and Retry-After when the analytics bucket is exhausted", async () => {
    const request = createAnalyticsRequest({ path: "/", type: "PAGE_VIEW" });
    const identity = getRequestIdentity(request.headers, "analytics");
    await createExhaustedBucket(
      `analytics:${identity.hash}`,
      ANALYTICS_RATE_LIMIT_POLICY.limit,
      ANALYTICS_RATE_LIMIT_POLICY.windowMs,
    );

    const response = await analyticsPOST(request);

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await prisma.analyticsDailyMetric.count()).toBe(0);
  });

  test("rate limits rejected dynamic-path attempts before public-route validation", async () => {
    const request = createAnalyticsRequest({
      path: "/posts/not-published",
      type: "PAGE_VIEW",
    });
    const identity = getRequestIdentity(request.headers, "analytics");
    await createExhaustedBucket(
      `analytics:attempt:${identity.hash}`,
      ANALYTICS_ATTEMPT_RATE_LIMIT_POLICY.limit,
      ANALYTICS_ATTEMPT_RATE_LIMIT_POLICY.windowMs,
    );

    const response = await analyticsPOST(request);

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await prisma.analyticsDailyMetric.count()).toBe(0);
  });
});

describe("login rate limiting", () => {
  test("returns a stable RATE_LIMITED code with an actual 429 response", async () => {
    const request = createLoginRequest();
    const identity = getRequestIdentity(request.headers, "login");
    await createExhaustedBucket(
      `login:address:${identity.hash}`,
      LOGIN_RATE_LIMIT_POLICIES.address.limit,
      LOGIN_RATE_LIMIT_POLICIES.address.windowMs,
    );

    const response = await authPOST(request, {
      params: Promise.resolve({ nextauth: ["callback", "credentials"] }),
    });
    const payload = await response.json() as { url: string };

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(new URL(payload.url).searchParams.get("error")).toBe("RATE_LIMITED");
  });
});

describe("admin analytics dashboard", () => {
  test("reads summed PAGE_VIEW aggregates", async () => {
    const today = startOfUtcDay(new Date());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    await prisma.analyticsDailyMetric.createMany({
      data: [
        { count: 3, date: today, dimension: "", path: "/posts/a", type: "PAGE_VIEW" },
        { count: 2, date: yesterday, dimension: "", path: "/posts/b", type: "PAGE_VIEW" },
        { count: 9, date: today, dimension: "90", path: "/posts/a", type: "READ_DEPTH" },
        { count: 4, date: today, dimension: "missing topic", path: "/search", type: "SEARCH_ZERO" },
      ],
    });

    const dashboard = await getAdminDashboardData();

    expect(dashboard.visitStats).toEqual({ today: 3, total: 5, week: 5 });
    expect(dashboard.topPaths).toEqual([
      { count: 3, path: "/posts/a" },
      { count: 2, path: "/posts/b" },
    ]);
    expect(dashboard.zeroResultQueries).toEqual([{ count: 4, query: "missing topic" }]);
  });
});

function createAnalyticsRequest(
  payload: Record<string, unknown>,
  options: {
    readonly address?: string;
    readonly origin?: string;
    readonly userAgent?: string;
  } = {},
) {
  return new NextRequest(`${SITE_ORIGIN}/api/analytics`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      Origin: options.origin ?? SITE_ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": options.userAgent ?? "Prelog integration test",
      "X-Forwarded-For": options.address ?? "203.0.113.55",
    },
    method: "POST",
  });
}

function createLoginRequest() {
  const body = new URLSearchParams({
    email: "admin@example.com",
    json: "true",
    password: "wrong-password",
  });

  return new NextRequest(`${SITE_ORIGIN}/api/auth/callback/credentials`, {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Prelog integration test",
      "X-Forwarded-For": "203.0.113.56",
    },
    method: "POST",
  });
}

async function createExhaustedBucket(key: string, count: number, windowMs: number) {
  await prisma.rateLimitBucket.create({
    data: {
      count,
      expiresAt: new Date(Date.now() + windowMs),
      key,
    },
  });
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
