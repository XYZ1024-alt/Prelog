-- CreateEnum
CREATE TYPE "PostRevisionReason" AS ENUM ('SAVE', 'PUBLISH', 'RESTORE');

-- CreateEnum
CREATE TYPE "AnalyticsMetricType" AS ENUM ('PAGE_VIEW', 'READ_DEPTH', 'SEARCH', 'SEARCH_ZERO', 'REFERRER');

-- CreateTable
CREATE TABLE "PostRevision" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" "PostRevisionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPreviewToken" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostPreviewToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AnalyticsDailyMetric" (
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AnalyticsMetricType" NOT NULL,
    "path" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailyMetric_pkey" PRIMARY KEY ("date","type","path","dimension")
);

-- Backfill legacy page views into privacy-preserving daily aggregates.
INSERT INTO "AnalyticsDailyMetric" ("date", "type", "path", "dimension", "count", "updatedAt")
SELECT
    date_trunc('day', legacy."createdAt"),
    'PAGE_VIEW'::"AnalyticsMetricType",
    legacy."normalizedPath",
    '',
    COUNT(*)::INTEGER,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        "createdAt",
        regexp_replace("path", '[?#].*$', '') AS "normalizedPath"
    FROM "PageView"
) AS legacy
WHERE legacy."normalizedPath" LIKE '/%'
  AND octet_length(legacy."normalizedPath") <= 512
  AND legacy."normalizedPath" NOT IN ('/admin', '/api', '/preview')
  AND legacy."normalizedPath" NOT LIKE '/admin/%'
  AND legacy."normalizedPath" NOT LIKE '/api/%'
  AND legacy."normalizedPath" NOT LIKE '/preview/%'
GROUP BY date_trunc('day', legacy."createdAt"), legacy."normalizedPath"
ON CONFLICT ("date", "type", "path", "dimension")
DO UPDATE SET "count" = "AnalyticsDailyMetric"."count" + EXCLUDED."count", "updatedAt" = CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "PostRevision_postId_createdAt_idx" ON "PostRevision"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostPreviewToken_tokenHash_key" ON "PostPreviewToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PostPreviewToken_postId_idx" ON "PostPreviewToken"("postId");

-- CreateIndex
CREATE INDEX "PostPreviewToken_expiresAt_idx" ON "PostPreviewToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "AnalyticsDailyMetric_type_date_idx" ON "AnalyticsDailyMetric"("type", "date");

-- CreateIndex
CREATE INDEX "AnalyticsDailyMetric_path_type_date_idx" ON "AnalyticsDailyMetric"("path", "type", "date");

-- AddForeignKey
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPreviewToken" ADD CONSTRAINT "PostPreviewToken_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
