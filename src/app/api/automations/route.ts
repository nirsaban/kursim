import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { automationSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const automations = await forTenant(auth.tenantId!).emailAutomation.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ automations });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, automationSchema);
  if ('error' in parsed) return parsed.error;

  const automation = await forTenant(auth.tenantId!).emailAutomation.create({
    data: { ...parsed.data, tenantId: auth.tenantId! },
  });
  return NextResponse.json({ automation }, { status: 201 });
}
