-- Super-admin-editable platform config (package prices + Grow payment links).
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformSetting" TO kursim_app;
