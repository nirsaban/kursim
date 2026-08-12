-- Single-use, expiring tokens for self-serve password reset. Only the SHA-256
-- hash of a token is stored, so a dump of this table can't be replayed.
CREATE TYPE "AuthTokenKind" AS ENUM ('RESET');

CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AuthTokenKind" NOT NULL DEFAULT 'RESET',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_tenantId_userId_idx" ON "AuthToken"("tenantId", "userId");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuthToken" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "AuthToken" TO kursim_app;

-- Buyer-receipt delivery outcome. It was already computed in the Grow webhook
-- and returned in a response body Grow discards, leaving no way to answer
-- "did the receipt actually send?" after the fact.
ALTER TABLE "Purchase" ADD COLUMN "mailedBuyer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Purchase" ADD COLUMN "mailError" TEXT;
