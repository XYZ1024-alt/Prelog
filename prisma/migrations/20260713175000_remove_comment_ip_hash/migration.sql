-- Keep the nullable column for one release so rollback remains possible; the new app no longer writes it.
UPDATE "Comment" SET "ipHash" = NULL WHERE "ipHash" IS NOT NULL;
