import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/tenant/prisma';
import {
  attendeeName,
  attendeePhone,
  loadCalcomConfig,
  type CalcomPayload,
} from '@/lib/calcom';
import { sendPlatformWhatsapp } from '@/lib/platform-wa';
import { formatSlot } from '@/lib/lead-bot';
import { he } from '@/lib/he';

export const dynamic = 'force-dynamic';

/**
 * Cal.com webhook receiver for platform leads (pattern ported from Kesher).
 *
 * When a lead books through the platform's Cal.com link, this records the
 * appointment on the Lead, confirms it back over WhatsApp, and pings the
 * admin. Cancellations and reschedules keep the lead in sync.
 *
 * Authenticity: Cal.com signs the raw body with HMAC-SHA256 in
 * `x-cal-signature-256` using the webhook secret the super-admin stored on
 * the Leads page. Verification is required — an unsigned endpoint that
 * mutates leads by phone number would be an open write API.
 */

interface CalcomEvent {
  triggerEvent?: string;
  payload?: CalcomPayload;
}

function verifySignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const { secret } = await loadCalcomConfig();
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 401 });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-cal-signature-256'), secret)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let event: CalcomEvent;
  try {
    event = JSON.parse(raw) as CalcomEvent;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const trigger = event.triggerEvent ?? '';
  const p = event.payload ?? {};

  // Cancels/reschedules address a booking we already know by uid.
  if (trigger === 'BOOKING_CANCELLED' || trigger === 'BOOKING_RESCHEDULED') {
    const lead = p.uid
      ? await prisma.lead.findFirst({ where: { calcomUid: p.uid } })
      : null;
    if (!lead) return NextResponse.json({ ok: true, note: 'no_matching_lead' });

    if (trigger === 'BOOKING_CANCELLED') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'greeted', appointmentAt: null, calcomUid: null },
      });
    } else if (p.startTime) {
      const at = new Date(p.startTime);
      await prisma.lead.update({ where: { id: lead.id }, data: { appointmentAt: at } });
      if (lead.phone) {
        await sendPlatformWhatsapp(lead.phone, he.leadBotConfirmed.replace('{slot}', formatSlot(at)));
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (trigger !== 'BOOKING_CREATED') {
    return NextResponse.json({ ok: true, note: 'ignored_event' });
  }
  if (!p.startTime) return NextResponse.json({ error: 'missing_times' }, { status: 400 });

  // Idempotency: Cal.com retries deliveries — the uid makes reruns no-ops.
  if (p.uid) {
    const already = await prisma.lead.findFirst({ where: { calcomUid: p.uid } });
    if (already) return NextResponse.json({ ok: true, note: 'already_recorded' });
  }

  // Match the booking to the lead by the attendee's own phone — the only
  // identifier both systems share, and the only one we can message. A booker
  // with no prior lead becomes one: booking straight off the link is a lead.
  const phone = attendeePhone(p);
  const name = attendeeName(p);
  const at = new Date(p.startTime);

  let lead = phone
    ? await prisma.lead.findFirst({
        where: { phone: { endsWith: phone.slice(-9) } },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  if (lead) {
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: 'scheduled',
        appointmentAt: at,
        calcomUid: p.uid ?? null,
        // The attendee typed their real name into the booking form — better
        // than a missing name, but never overwrite one we already have.
        ...(!lead.name && name ? { name } : {}),
      },
    });
  } else if (phone) {
    lead = await prisma.lead.create({
      data: {
        name: name ?? '',
        contact: phone,
        phone,
        source: 'calcom',
        status: 'scheduled',
        appointmentAt: at,
        calcomUid: p.uid ?? null,
      },
    });
  } else {
    // No phone anywhere in the booking — record nothing rather than pinning
    // the meeting onto the wrong lead.
    return NextResponse.json({ ok: true, note: 'no_attendee_phone' });
  }

  // Confirm to the lead and wake the admin — both best-effort: the booking is
  // recorded, and a WhatsApp hiccup must not make Cal.com retry the webhook.
  await sendPlatformWhatsapp(phone!, he.leadBotConfirmed.replace('{slot}', formatSlot(at)));
  if (process.env.PLATFORM_ADMIN_PHONE) {
    await sendPlatformWhatsapp(
      process.env.PLATFORM_ADMIN_PHONE,
      he.leadBotAdminAlert
        .replace('{name}', lead.name || phone!)
        .replace('{phone}', phone!)
        .replace('{slot}', formatSlot(at)),
    );
  }
  return NextResponse.json({ ok: true });
}
