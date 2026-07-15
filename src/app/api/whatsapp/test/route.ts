import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { whatsappTestSchema } from '@/lib/validation/schemas';
import { sendWhatsappText } from '@/lib/whatsapp';
import { he } from '@/lib/he';

export const runtime = 'nodejs';

/** Owner sends themselves a WhatsApp test message to confirm the connection. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, whatsappTestSchema);
  if ('error' in parsed) return parsed.error;

  const result = await sendWhatsappText(auth.tenantId!, parsed.data.phone, he.waTestMessage, 'test');
  return NextResponse.json({ ok: result.ok, error: result.error ?? null });
}
