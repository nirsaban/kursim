import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { apiKeyCreateSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashApiKey } from '@/lib/api-keys';

export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const keys = await forTenant(auth.tenantId!).apiKey.findMany({
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ keys });
}

/** Mints a key and returns the plaintext ONCE — only its hash is stored. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, apiKeyCreateSchema);
  if ('error' in parsed) return parsed.error;

  const plaintext = `ksk_${randomBytes(24).toString('base64url')}`;
  const key = await forTenant(auth.tenantId!).apiKey.create({
    data: {
      tenantId: auth.tenantId!,
      name: parsed.data.name,
      keyHash: hashApiKey(plaintext),
      prefix: plaintext.slice(0, 12),
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });
  return NextResponse.json({ key, plaintext }, { status: 201 });
}
