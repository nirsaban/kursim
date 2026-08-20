-- Unique-visitor counters for the two public pages that had none: the
-- tenant's linktree page and each course's landing page. Same dedup scheme
-- as the existing AffiliateLink.visits (IP+UA hash in a Redis set) — columns
-- only, no new RLS/grants needed ("Course" already has both; "Tenant" has
-- neither, by design — see resolve.ts).
ALTER TABLE "Tenant" ADD COLUMN "linktreeViews" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Course" ADD COLUMN "landingViews" INTEGER NOT NULL DEFAULT 0;
