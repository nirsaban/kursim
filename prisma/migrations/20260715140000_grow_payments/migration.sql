-- Grow payment webhook: per-tenant webhook secret + Purchase records.

-- Per-tenant secret embedded in the webhook URL. Backfills existing tenants and
-- defaults new ones to a random value (gen_random_uuid is built in on PG13+).
ALTER TABLE "Tenant" ADD COLUMN "webhookSecret" TEXT DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Purchase: one row per completed payment (idempotent on tenantId+transactionId).
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "transactionId" TEXT NOT NULL,
    "payerEmail" TEXT NOT NULL,
    "payerPhone" TEXT NOT NULL DEFAULT '',
    "payerName" TEXT NOT NULL DEFAULT '',
    "amount" TEXT NOT NULL DEFAULT '',
    "provisionedUserId" UUID,
    "isNewUser" BOOLEAN NOT NULL DEFAULT false,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_tenantId_transactionId_key" ON "Purchase"("tenantId", "transactionId");
CREATE INDEX "Purchase_tenantId_createdAt_idx" ON "Purchase"("tenantId", "createdAt");
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Purchase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Purchase" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "Purchase" TO kursim_app;
