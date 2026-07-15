-- Extended platform features: notifications, broadcasts, community, lesson Q&A,
-- access codes, certificates, lesson notes, wishlist, and module drip release.
-- Every new table is tenant-owned: denormalized tenantId + two-layer RLS + grant.

-- Drip release on modules (0 = immediate).
ALTER TABLE "Module" ADD COLUMN "dripDays" INTEGER NOT NULL DEFAULT 0;

-- ── Notification ─────────────────────────────────────────────────────────────
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_tenantId_userId_createdAt_idx" ON "Notification"("tenantId", "userId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Broadcast ────────────────────────────────────────────────────────────────
CREATE TABLE "Broadcast" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "courseId" UUID,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Broadcast_tenantId_createdAt_idx" ON "Broadcast"("tenantId", "createdAt");
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CommunityPost ────────────────────────────────────────────────────────────
CREATE TABLE "CommunityPost" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommunityPost_tenantId_pinned_createdAt_idx" ON "CommunityPost"("tenantId", "pinned", "createdAt");
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CommunityReply ───────────────────────────────────────────────────────────
CREATE TABLE "CommunityReply" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommunityReply_tenantId_postId_createdAt_idx" ON "CommunityReply"("tenantId", "postId", "createdAt");
ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── LessonQuestion ───────────────────────────────────────────────────────────
CREATE TABLE "LessonQuestion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "studentName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "answeredById" UUID,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LessonQuestion_tenantId_lessonId_createdAt_idx" ON "LessonQuestion"("tenantId", "lessonId", "createdAt");
ALTER TABLE "LessonQuestion" ADD CONSTRAINT "LessonQuestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonQuestion" ADD CONSTRAINT "LessonQuestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AccessCode ───────────────────────────────────────────────────────────────
CREATE TABLE "AccessCode" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");
CREATE INDEX "AccessCode_tenantId_courseId_idx" ON "AccessCode"("tenantId", "courseId");
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Certificate ──────────────────────────────────────────────────────────────
CREATE TABLE "Certificate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "studentName" TEXT NOT NULL DEFAULT '',
    "courseTitle" TEXT NOT NULL DEFAULT '',
    "serial" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");
CREATE UNIQUE INDEX "Certificate_courseId_studentId_key" ON "Certificate"("courseId", "studentId");
CREATE INDEX "Certificate_tenantId_idx" ON "Certificate"("tenantId");
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── LessonNote ───────────────────────────────────────────────────────────────
CREATE TABLE "LessonNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonNote_studentId_lessonId_key" ON "LessonNote"("studentId", "lessonId");
CREATE INDEX "LessonNote_tenantId_studentId_idx" ON "LessonNote"("tenantId", "studentId");
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Wishlist ─────────────────────────────────────────────────────────────────
CREATE TABLE "Wishlist" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wishlist_studentId_courseId_key" ON "Wishlist"("studentId", "courseId");
CREATE INDEX "Wishlist_tenantId_studentId_idx" ON "Wishlist"("tenantId", "studentId");
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RLS: two-layer tenant isolation on every new table ───────────────────────
ALTER TABLE "Notification"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Broadcast"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityPost"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityReply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessCode"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonNote"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wishlist"       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Notification"   USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "Broadcast"      USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "CommunityPost"  USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "CommunityReply" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "LessonQuestion" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "AccessCode"     USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "Certificate"    USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "LessonNote"     USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON "Wishlist"       USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "Notification"   TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Broadcast"      TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CommunityPost"  TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "CommunityReply" TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "LessonQuestion" TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AccessCode"     TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Certificate"    TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "LessonNote"     TO kursim_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Wishlist"       TO kursim_app;
