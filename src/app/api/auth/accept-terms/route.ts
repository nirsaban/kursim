import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseTerms } from '@/lib/validation/branding';
import { prisma } from '@/lib/tenant/prisma';

/** Stamps the signed-in user's acceptance of the tenant's current terms version. */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { terms: true },
  });
  const terms = parseTerms(tenant?.terms);

  await forTenant(auth.tenantId!).user.updateMany({
    where: { id: auth.userId },
    data: { acceptedTermsAt: new Date(), acceptedTermsVersion: terms.version },
  });
  return NextResponse.json({ ok: true });
}
