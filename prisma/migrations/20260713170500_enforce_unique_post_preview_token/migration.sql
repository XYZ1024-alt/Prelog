-- Keep only the newest credential if this table existed before postId became unique.
DELETE FROM "PostPreviewToken" AS older
USING "PostPreviewToken" AS newer
WHERE older."postId" = newer."postId"
  AND (
    older."createdAt" < newer."createdAt"
    OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "PostPreviewToken_postId_key"
ON "PostPreviewToken"("postId");

DROP INDEX IF EXISTS "PostPreviewToken_postId_idx";
