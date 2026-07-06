-- Private student feedback to the owner, alongside the public review
ALTER TABLE "CourseReview" ADD COLUMN "privateNote" TEXT NOT NULL DEFAULT '';
