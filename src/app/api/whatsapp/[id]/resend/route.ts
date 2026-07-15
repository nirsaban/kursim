import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { resendSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { sendWhatsappText } from '@/lib/whatsapp';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/** Resend a logged WhatsApp message, optionally to a corrected phone. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, resendSchema);
  if ('error' in parsed) return parsed.error;

  const msg = await forTenant(auth.tenantId!).whatsappMessage.findFirst({ where: { id } });
  if (!msg) return apiError(404, 'not_found');

  const phone = (parsed.data.phone ?? msg.toPhone ?? '').trim();
  if (!phone) return apiError(400, 'no_phone');

  const result = await sendWhatsappText(auth.tenantId!, phone, msg.body, msg.kind);
  return NextResponse.json({ ok: result.ok, error: result.error ?? null });
}
