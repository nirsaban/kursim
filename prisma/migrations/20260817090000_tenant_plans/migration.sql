-- Sellable packages: every tenant carries a plan. New self-served schools
-- start FREE (build everything, pay to invite students / publish a landing
-- page); tenants that existed before billing keep everything they had.
ALTER TABLE "Tenant" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "Tenant" ADD COLUMN "planActivatedAt" TIMESTAMP(3);

-- Grandfather existing schools so the paywall never fires on a live customer.
UPDATE "Tenant" SET "plan" = 'UNLIMITED', "planActivatedAt" = now();
