-- RLS: Enable Row Level Security on tenant-owned tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant isolation policy for User table
CREATE POLICY tenant_isolation ON "User" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
  OR ("tenantId" IS NULL AND current_setting('app.is_super', true) = 'true')
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
  OR ("tenantId" IS NULL AND current_setting('app.is_super', true) = 'true')
);

-- RLS: Tenant isolation policy for Invite table
CREATE POLICY tenant_isolation ON "Invite" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- RLS: Tenant isolation policy for Course table
CREATE POLICY tenant_isolation ON "Course" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- RLS: Tenant isolation policy for Module table
CREATE POLICY tenant_isolation ON "Module" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- RLS: Tenant isolation policy for Lesson table
CREATE POLICY tenant_isolation ON "Lesson" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- RLS: Tenant isolation policy for Attachment table
CREATE POLICY tenant_isolation ON "Attachment" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- RLS: Tenant isolation policy for Progress table
CREATE POLICY tenant_isolation ON "Progress" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- RLS: Tenant isolation policy for Enrollment table
CREATE POLICY tenant_isolation ON "Enrollment" USING (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
) WITH CHECK (
  current_setting('app.is_super', true) = 'true'
  OR "tenantId"::text = current_setting('app.tenant_id', true)
);

-- Grants: Allow kursim_app role to interact with all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kursim_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kursim_app;
