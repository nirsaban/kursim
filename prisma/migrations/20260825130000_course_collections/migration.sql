-- Combined landing pages: one public page promoting several courses, each
-- keeping its own checkout. Tenant-owned, so the same two-layer RLS as every
-- other tenant table.
CREATE TABLE "CourseCollection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "courseIds" UUID[],
    "content" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseCollection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseCollection_tenantId_createdAt_idx" ON "CourseCollection"("tenantId", "createdAt");
ALTER TABLE "CourseCollection" ADD CONSTRAINT "CourseCollection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseCollection" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CourseCollection"
  USING      (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "CourseCollection" TO kursim_app;
