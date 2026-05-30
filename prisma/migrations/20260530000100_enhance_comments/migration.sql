ALTER TYPE "CommentStatus" RENAME TO "CommentStatus_old";

CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN', 'SPAM');

ALTER TABLE "Comment"
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "moderationNote" TEXT,
  ADD COLUMN "spamScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ipHash" TEXT,
  ADD COLUMN "userAgent" TEXT;

ALTER TABLE "Comment"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Comment"
  ALTER COLUMN "status" TYPE "CommentStatus"
  USING (
    CASE "status"::text
      WHEN 'VISIBLE' THEN 'APPROVED'
      WHEN 'HIDDEN' THEN 'HIDDEN'
      ELSE 'PENDING'
    END
  )::"CommentStatus";

ALTER TABLE "Comment"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "CommentStatus_old";

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Comment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
CREATE INDEX "Comment_status_createdAt_idx" ON "Comment"("status", "createdAt");
