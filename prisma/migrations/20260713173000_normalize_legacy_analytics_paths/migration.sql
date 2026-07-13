-- Merge legacy query-bearing paths into canonical pathname-only daily aggregates.
INSERT INTO "AnalyticsDailyMetric" ("date", "type", "path", "dimension", "count", "updatedAt")
SELECT
  "date",
  "type",
  regexp_replace("path", '[?#].*$', ''),
  "dimension",
  SUM("count")::INTEGER,
  MAX("updatedAt")
FROM "AnalyticsDailyMetric"
WHERE "path" ~ '[?#]'
GROUP BY "date", "type", regexp_replace("path", '[?#].*$', ''), "dimension"
ON CONFLICT ("date", "type", "path", "dimension")
DO UPDATE SET
  "count" = "AnalyticsDailyMetric"."count" + EXCLUDED."count",
  "updatedAt" = GREATEST("AnalyticsDailyMetric"."updatedAt", EXCLUDED."updatedAt");

DELETE FROM "AnalyticsDailyMetric"
WHERE "path" ~ '[?#]';

DELETE FROM "AnalyticsDailyMetric"
WHERE "path" NOT LIKE '/%'
  OR "path" IN ('/admin', '/api', '/preview')
  OR "path" LIKE '/admin/%'
  OR "path" LIKE '/api/%'
  OR "path" LIKE '/preview/%';
