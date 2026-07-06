-- Course landing-page marketing content (collected by the owner onboarding wizard)
ALTER TABLE "Course" ADD COLUMN "marketing" JSONB;
ALTER TABLE "Course" ADD COLUMN "landingPublished" BOOLEAN NOT NULL DEFAULT false;
