-- Platform sales leads (marketing-site contact form + WhatsApp scheduling bot).
-- Platform-level table like Tenant: no tenantId, no RLS.
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'landing',
    "status" TEXT NOT NULL DEFAULT 'new',
    "appointmentAt" TIMESTAMP(3),
    "botState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

GRANT SELECT, INSERT, UPDATE, DELETE ON "Lead" TO kursim_app;
