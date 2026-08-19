-- School-wide social links + the LinkTree page (both JSON, validated in app
-- code by socialsSchema / linktreeSchema).
ALTER TABLE "Tenant" ADD COLUMN "socials" JSONB;
ALTER TABLE "Tenant" ADD COLUMN "linktree" JSONB;
