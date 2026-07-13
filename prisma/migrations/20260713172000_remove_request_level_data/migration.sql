-- Remove private paths that may have been copied from legacy request-level analytics.
DELETE FROM "AnalyticsDailyMetric"
WHERE "path" IN ('/admin', '/api', '/preview')
  OR "path" LIKE '/admin/%'
  OR "path" LIKE '/api/%'
  OR "path" LIKE '/preview/%';

-- Keep the empty table for one release so the previous app remains rollback-compatible.
DELETE FROM "PageView";

-- Keep the nullable column for one release; the new app no longer writes it.
UPDATE "Comment" SET "userAgent" = NULL WHERE "userAgent" IS NOT NULL;
