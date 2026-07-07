-- AI-generated course marketing media (Veo 240-frame scroll sequence + Imagen stills)
CREATE TABLE "CourseMedia" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "framesBaseUrl" TEXT,
    "frameCount" INTEGER NOT NULL DEFAULT 240,
    "posterUrl" TEXT,
    "videoUrl" TEXT,
    "stills" JSONB,
    "promptJson" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseMedia_courseId_key" ON "CourseMedia"("courseId");
CREATE INDEX "CourseMedia_tenantId_idx" ON "CourseMedia"("tenantId");

ALTER TABLE "CourseMedia" ADD CONSTRAINT "CourseMedia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMedia" ADD CONSTRAINT "CourseMedia_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same two-layer tenant isolation as every tenant-owned table
ALTER TABLE "CourseMedia" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CourseMedia" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "CourseMedia" TO kursim_app;
