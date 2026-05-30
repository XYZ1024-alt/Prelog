UPDATE "User"
SET "id" = 'admin'
WHERE "id" = (
    SELECT "id"
    FROM "User"
    ORDER BY CASE WHEN "id" = 'admin' THEN 0 ELSE 1 END, "createdAt" ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1
    FROM "User"
    WHERE "id" = 'admin'
);

DELETE FROM "User"
WHERE "id" <> 'admin';
