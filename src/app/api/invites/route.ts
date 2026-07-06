import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { inviteSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { generateInviteToken } from '@/lib/invites';

export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const invites = await forTenant(auth.tenantId!).invite.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, inviteSchema);
  if ('error' in parsed) return parsed.error;

  const { token, tokenHash } = generateInviteToken();
  const invite = await forTenant(auth.tenantId!).invite.create({
    data: {
      tenantId: auth.tenantId!,
      tokenHash,
      email: parsed.data.email?.toLowerCase() ?? null,
      role: parsed.data.role,
      expiresAt: new Date(Date.now() + parsed.data.expiresInHours * 3600_000),
    },
  });

  // The raw token appears only in this response — it is never stored.
  const url = `${process.env.APP_URL ?? ''}/t/${auth.tenantSlug}/invite/${token}`;
  return NextResponse.json(
    { invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, url },
    { status: 201 },
  );
}
