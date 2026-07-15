-- Per-tenant WhatsApp message log (queued → sent/failed).
CREATE TABLE "WhatsappMessage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'login',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsappMessage_tenantId_createdAt_idx" ON "WhatsappMessage"("tenantId", "createdAt");
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsappMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WhatsappMessage" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "WhatsappMessage" TO kursim_app;
