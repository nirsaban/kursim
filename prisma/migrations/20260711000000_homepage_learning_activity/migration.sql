-- Owner-customizable student-home content (validated in app by homepageSchema)
ALTER TABLE "Tenant" ADD COLUMN "homepage" JSONB;

-- One row per student per active learning day; powers streaks + activity calendar
CREATE TABLE "LearningActivity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningActivity_studentId_date_key" ON "LearningActivity"("studentId", "date");
CREATE INDEX "LearningActivity_tenantId_idx" ON "LearningActivity"("tenantId");
CREATE INDEX "LearningActivity_tenantId_studentId_idx" ON "LearningActivity"("tenantId", "studentId");

ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same two-layer tenant isolation as every tenant-owned table
ALTER TABLE "LearningActivity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LearningActivity" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "LearningActivity" TO kursim_app;
