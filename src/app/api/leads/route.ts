import { NextResponse } from 'next/server';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { leadSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/tenant/prisma';
import { normalizeIlPhone } from '@/lib/whatsapp';
import { sendPlatformWhatsapp } from '@/lib/platform-wa';
import { slotListMessage, upcomingSlots } from '@/lib/lead-bot';

const LEAD_LIMIT = { limit: 5, windowSec: 3600 };

/**
 * Marketing-site contact form. Stores the lead; when the contact is a phone,
 * the platform WhatsApp number greets them immediately with meeting slots —
 * the scheduling bot takes it from there.
 */
export async function POST(req: Request) {
  const rl = await rateLimit('leads', clientIp(req), LEAD_LIMIT);
  if (!rl.allowed) return apiError(429, 'too_many_attempts');

  const parsed = await parseBody(req, leadSchema);
  if ('error' in parsed) return parsed.error;
  const { name, contact, message, website } = parsed.data;

  // Honeypot filled → a bot. Pretend success, store nothing.
  if (website) return NextResponse.json({ ok: true });

  const phone = normalizeIlPhone(contact);
  const slots = phone ? upcomingSlots() : null;

  await prisma.lead.create({
    data: {
      name,
      contact,
      phone,
      message,
      status: phone ? 'greeted' : 'new',
      botState: slots ? { offeredSlots: slots.map((s) => s.toISOString()) } : undefined,
    },
  });

  if (phone && slots) {
    await sendPlatformWhatsapp(phone, slotListMessage(name, slots));
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
