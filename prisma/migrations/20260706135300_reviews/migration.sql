-- Student course reviews, collected at course completion and moderated by the owner
CREATE TABLE "CourseReview" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseReview_courseId_studentId_key" ON "CourseReview"("courseId", "studentId");

ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same two-layer tenant isolation as every tenant-owned table
ALTER TABLE "CourseReview" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CourseReview" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "CourseReview" TO kursim_app;
