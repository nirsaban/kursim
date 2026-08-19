-- Grow package payments (first charge + every standing-order cycle).
-- Platform-level table like Lead: no RLS. transactionId unique = idempotency.
CREATE TABLE "PlanPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "plan" TEXT,
    "amount" TEXT NOT NULL DEFAULT '',
    "payerEmail" TEXT NOT NULL DEFAULT '',
    "payerName" TEXT NOT NULL DEFAULT '',
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanPayment_transactionId_key" ON "PlanPayment"("transactionId");
CREATE INDEX "PlanPayment_tenantId_idx" ON "PlanPayment"("tenantId");
CREATE INDEX "PlanPayment_createdAt_idx" ON "PlanPayment"("createdAt");

ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
