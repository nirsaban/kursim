-- AI mentor ("מנטור"): course-grounded assistant on the school's WhatsApp
-- number, available on the GROWTH package and up.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
CREATE INDEX "User_phone_idx" ON "User"("phone");
ALTER TABLE "Course" ADD COLUMN "mentorEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Lesson" ADD COLUMN "transcript" TEXT;
