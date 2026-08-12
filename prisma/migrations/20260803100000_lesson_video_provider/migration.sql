-- Where a lesson's video is stored. Everything uploaded so far is on
-- Cloudinary, so the default backfills existing rows correctly.
CREATE TYPE "MediaProvider" AS ENUM ('CLOUDINARY', 'R2');

ALTER TABLE "Lesson"
  ADD COLUMN "videoProvider" "MediaProvider" NOT NULL DEFAULT 'CLOUDINARY';
