-- Hyp Pay checkout: a real price on courses, and an order created before the
-- buyer is redirected to Hyp's hosted payment page.
--
-- Hyp's success URL is configured per terminal, not per transaction, so the
-- completion redirect can't carry the tenant/course in its URL the way the
-- Grow callback did. PaymentOrder is what a single platform-wide return
-- endpoint resolves the redirect against — including the amount we intended
-- to charge, so a tampered redirect can't buy a course cheaply.

-- Sale price in agorot. Nullable: courses without one keep using the legacy
-- Grow link in `marketing.paymentLink`, so existing tenants sell uninterrupted.
ALTER TABLE "Course" ADD COLUMN "priceAgorot" INTEGER;

CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseIds" UUID[],
    "amountAgorot" INTEGER NOT NULL,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "buyerEmail" TEXT NOT NULL DEFAULT '',
    "buyerPhone" TEXT NOT NULL DEFAULT '',
    "buyerName" TEXT NOT NULL DEFAULT '',
    "hypTransactionId" TEXT,
    "ccode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentOrder_tenantId_createdAt_idx" ON "PaymentOrder"("tenantId", "createdAt");
CREATE INDEX "PaymentOrder_tenantId_status_idx" ON "PaymentOrder"("tenantId", "status");
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentOrder" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "PaymentOrder" TO kursim_app;

-- Which gateway settled a sale. Existing rows are all Grow.
ALTER TABLE "Purchase" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'grow';
