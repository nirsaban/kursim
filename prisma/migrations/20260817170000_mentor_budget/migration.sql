-- Mentor cost control: per-school monthly budget + token usage ledger.
ALTER TABLE "Tenant" ADD COLUMN "mentorBudgetCents" INTEGER NOT NULL DEFAULT 1000;

CREATE TABLE "MentorUsage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MentorUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MentorUsage_tenantId_month_key" ON "MentorUsage"("tenantId", "month");
CREATE INDEX "MentorUsage_month_idx" ON "MentorUsage"("month");
ALTER TABLE "MentorUsage" ADD CONSTRAINT "MentorUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorUsage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MentorUsage" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "MentorUsage" TO kursim_app;
