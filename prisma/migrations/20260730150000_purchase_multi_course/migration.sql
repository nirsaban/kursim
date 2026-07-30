-- One Grow payment link may sell several products, one per course. Record every
-- course a single transaction granted, while keeping one row per transaction so
-- the sale amount is not counted twice.
ALTER TABLE "Purchase" ADD COLUMN "courseIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

-- Backfill: existing rows granted exactly the one course they name.
UPDATE "Purchase" SET "courseIds" = ARRAY["courseId"] WHERE cardinality("courseIds") = 0;
