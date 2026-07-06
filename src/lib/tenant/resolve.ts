import type { Tenant } from '@prisma/client';
import { prisma } from './prisma';

// Tenant is the one non-RLS table: it must be readable to map slug → tenantId.
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  return prisma.tenant.findUnique({ where: { slug } });
}
