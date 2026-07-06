import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __kursimPrisma: PrismaClient | undefined;
}

/**
 * Base client, connected as the non-superuser app role (subject to RLS).
 * Only safe for non-RLS tables (Tenant) — everything tenant-owned must go
 * through forTenant()/asSuperAdmin() in scoped-prisma.ts.
 */
export const prisma: PrismaClient =
  globalThis.__kursimPrisma ?? (globalThis.__kursimPrisma = new PrismaClient());
