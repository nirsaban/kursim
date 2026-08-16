-- Skale-inspired growth features: tenant branding, terms gate, email
-- automations ("learning reminders"), and per-tenant API keys for auto-enroll.
-- New tables are tenant-owned: denormalized tenantId + two-layer RLS + grant.

-- Tenant branding + terms configs (both JSON, validated in app code).
ALTER TABLE "Tenant" ADD COLUMN "branding" JSONB;
ALTER TABLE "Tenant" ADD COLUMN "terms" JSONB;

-- Terms acceptance stamp per user (version re-prompts on bump).
ALTER TABLE "User" ADD COLUMN "acceptedTermsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "acceptedTermsVersion" INTEGER NOT NULL DEFAULT 0;

-- ── EmailAutomation ──────────────────────────────────────────────────────────
CREATE TABLE "EmailAutomation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 3,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailAutomation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailAutomation_tenantId_idx" ON "EmailAutomation"("tenantId");
ALTER TABLE "EmailAutomation" ADD CONSTRAINT "EmailAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AutomationSend ───────────────────────────────────────────────────────────
CREATE TABLE "AutomationSend" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationSend_automationId_studentId_key" ON "AutomationSend"("automationId", "studentId");
CREATE INDEX "AutomationSend_tenantId_idx" ON "AutomationSend"("tenantId");
ALTER TABLE "AutomationSend" ADD CONSTRAINT "AutomationSend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationSend" ADD CONSTRAINT "AutomationSend_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "EmailAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationSend" ADD CONSTRAINT "AutomationSend_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ApiKey ───────────────────────────────────────────────────────────────────
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey"("tenantId");
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE "EmailAutomation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationSend"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey"          ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "EmailAutomation" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "AutomationSend"  USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "ApiKey"          USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "EmailAutomation" TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AutomationSend"  TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ApiKey"          TO kursim_app;
