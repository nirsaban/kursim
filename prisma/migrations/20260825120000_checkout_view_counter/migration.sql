-- Unique-visitor counter for the checkout (pre-payment) page, completing the
-- landing -> checkout -> payment started -> paid funnel. Same dedup scheme as
-- Course.landingViews.
ALTER TABLE "Course" ADD COLUMN "checkoutViews" INTEGER NOT NULL DEFAULT 0;
