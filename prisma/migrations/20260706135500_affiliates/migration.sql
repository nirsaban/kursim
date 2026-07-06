-- Affiliate share links: enrolled students share course landing pages and
-- earn a coin for every N unique visitors (default 100)
CREATE TABLE "AffiliateLink" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");
CREATE UNIQUE INDEX "AffiliateLink_courseId_studentId_key" ON "AffiliateLink"("courseId", "studentId");

ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same two-layer tenant isolation as every tenant-owned table
ALTER TABLE "AffiliateLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AffiliateLink" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "AffiliateLink" TO kursim_app;
