-- Per-tenant catalog number for courses. The owner copies this into the
-- matching Grow product's "catalog_number" field, and the payment callback
-- matches on it to grant only the courses actually bought.

ALTER TABLE "Course" ADD COLUMN "catalogNumber" INTEGER;

-- Backfill: number existing courses 1..n per tenant, oldest first, so the
-- numbering reads in the order the owner created them.
UPDATE "Course" c
SET "catalogNumber" = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS rn
  FROM "Course"
) s
WHERE c.id = s.id;

ALTER TABLE "Course" ALTER COLUMN "catalogNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Course_tenantId_catalogNumber_key" ON "Course"("tenantId", "catalogNumber");
