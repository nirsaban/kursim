-- Large videos are stored on this server's disk now, not on R2. Nothing was
-- ever written with the R2 value (it needed credentials that were never set),
-- but reset defensively so the type swap below can't fail on a stray row.
UPDATE "Lesson"
  SET "videoProvider" = 'CLOUDINARY', "videoPublicId" = NULL, "durationSec" = NULL
  WHERE "videoProvider" = 'R2';

ALTER TABLE "Lesson" ALTER COLUMN "videoProvider" DROP DEFAULT;
ALTER TYPE "MediaProvider" RENAME TO "MediaProvider_old";

CREATE TYPE "MediaProvider" AS ENUM ('CLOUDINARY', 'LOCAL');

ALTER TABLE "Lesson"
  ALTER COLUMN "videoProvider" TYPE "MediaProvider"
  USING ("videoProvider"::text::"MediaProvider");
ALTER TABLE "Lesson" ALTER COLUMN "videoProvider" SET DEFAULT 'CLOUDINARY';

DROP TYPE "MediaProvider_old";
