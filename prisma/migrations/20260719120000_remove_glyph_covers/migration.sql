-- Remove the Glyph cover system and manual cover support from posts.
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "coverImage",
DROP COLUMN "coverMode",
DROP COLUMN "glyphGeneratedAt",
DROP COLUMN "glyphRecipe",
DROP COLUMN "glyphSourceHash";

-- DropEnum
DROP TYPE "CoverMode";
