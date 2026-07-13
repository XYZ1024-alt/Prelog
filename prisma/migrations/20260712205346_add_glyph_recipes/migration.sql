-- CreateEnum
CREATE TYPE "CoverMode" AS ENUM ('GLYPH', 'MANUAL');

-- AlterTable
ALTER TABLE "Post"
  ADD COLUMN "coverMode" "CoverMode" NOT NULL DEFAULT 'GLYPH',
  ADD COLUMN "glyphRecipe" JSONB,
  ADD COLUMN "glyphSourceHash" TEXT,
  ADD COLUMN "glyphGeneratedAt" TIMESTAMP(3);

-- Backfill manual covers
UPDATE "Post"
SET "coverMode" = 'MANUAL'
WHERE COALESCE(BTRIM("coverImage"), '') <> '';
