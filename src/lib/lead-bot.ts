import { prisma } from '@/lib/tenant/prisma';
import { loadCalcomConfig } from '@/lib/calcom';
import { he } from '@/lib/he';

/**
 * The appointment-scheduling bot behind the platform WhatsApp number.
 *
 * Deterministic state machine, deliberately not an LLM. Two modes:
 * - Cal.com configured (super-admin → Leads page): the bot hands out the
 *   booking URL and the /api/webhooks/calcom receiver records the actual
 *   booking — real availability, not guessed slots.
 * - No Cal.com: fallback to numbered business-day slots; replying with a
 *   number books it.
 * Every dead end lands on a human ("נציג") so the bot can never strand a
 * paying customer.
 *
 * States (Lead.status): new → greeted → scheduled (→ greeted again on 'שינוי').
 */

const SLOT_HOURS = [10, 16];
const SLOT_COUNT = 6;

const dayFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  timeZone: 'Asia/Jerusalem',
});
const timeFmt = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
});

export function formatSlot(d: Date): string {
  return `${dayFmt.format(d)} · ${timeFmt.format(d)}`;
}

/** Next business-day (Sun–Thu) slots, starting tomorrow, Israel time. */
export function upcomingSlots(now = new Date()): Date[] {
  const slots: Date[] = [];
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() + 1);
  while (slots.length < SLOT_COUNT) {
    // Work off the JERUSALEM calendar day of the cursor — mixing the UTC
    // date-part with an Israel hour shifts evening runs a whole day back.
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(cursor); // e.g. "2026-08-18"
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Asia/Jerusalem',
    }).format(cursor);
    if (weekday !== 'Fri' && weekday !== 'Sat') {
      const [y, m, d] = ymd.split('-').map(Number);
      const offset = jerusalemOffsetHours(new Date(`${ymd}T12:00:00Z`));
      for (const hour of SLOT_HOURS) {
        if (slots.length >= SLOT_COUNT) break;
        slots.push(new Date(Date.UTC(y, m - 1, d, hour - offset, 0, 0)));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

/** Jerusalem UTC offset (2 or 3) for a given date. */
function jerusalemOffsetHours(d: Date): number {
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  const jlm = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  return Math.round((jlm.getTime() - utc.getTime()) / 3_600_000);
}

export function slotListMessage(name: string, slots: Date[]): string {
  const lines = slots.map((s, i) => `${i + 1}. ${formatSlot(s)}`);
  return he.leadBotGreeting.replace('{name}', name || '') + '\n\n' + lines.join('\n') + '\n\n' + he.leadBotPickHint;
}

/** Greeting when Cal.com is configured — the lead books on the real calendar. */
export function calcomGreeting(name: string, url: string): string {
  return he.leadBotCalcomGreeting.replace('{name}', name || '').replace('{url}', url);
}

export interface BotReply {
  text: string;
  /** Set when a meeting was just booked — callers notify the admin. */
  booked?: { name: string; phone: string; at: Date };
}

/**
 * One turn of the conversation: the lead (by phone) said `text`.
 * Returns what to answer, after persisting any state change.
 */
export async function handleLeadMessage(phone: string, text: string, pushName?: string): Promise<BotReply> {
  const trimmed = text.trim();
  const calcom = await loadCalcomConfig();
  let lead = await prisma.lead.findFirst({
    where: { phone },
    orderBy: { createdAt: 'desc' },
  });

  // Someone messaged the platform number out of the blue — treat as a fresh lead.
  if (!lead) {
    const slots = calcom.url ? null : upcomingSlots();
    lead = await prisma.lead.create({
      data: {
        name: pushName || '',
        contact: phone,
        phone,
        source: 'whatsapp',
        status: 'greeted',
        botState: slots ? { offeredSlots: slots.map((s) => s.toISOString()) } : undefined,
      },
    });
    return {
      text: calcom.url ? calcomGreeting(lead.name, calcom.url) : slotListMessage(lead.name, slots!),
    };
  }

  // Human handoff on request, from any state.
  if (/נציג|טלפון|אנושי/.test(trimmed)) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'closed' } });
    return { text: he.leadBotHuman };
  }

  if (lead.status === 'scheduled') {
    if (/שינוי|לשנות|ביטול/.test(trimmed)) {
      if (calcom.url) {
        // Rebooking happens on the calendar; the webhook keeps us in sync.
        return { text: calcomGreeting(lead.name, calcom.url) };
      }
      const slots = upcomingSlots();
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'greeted', botState: { offeredSlots: slots.map((s) => s.toISOString()) } },
      });
      return { text: slotListMessage(lead.name, slots) };
    }
    return {
      text: he.leadBotAlreadyScheduled.replace(
        '{slot}',
        lead.appointmentAt ? formatSlot(lead.appointmentAt) : '',
      ),
    };
  }

  // Cal.com mode: any other message gets the booking link — the calendar,
  // not the chat, is where the actual slot picking happens.
  if (calcom.url) {
    if (lead.status !== 'greeted') {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: 'greeted' } });
    }
    return { text: calcomGreeting(lead.name, calcom.url) };
  }

  // greeted / new / closed → try to read a slot number.
  const offered: string[] =
    (lead.botState as { offeredSlots?: string[] } | null)?.offeredSlots ?? [];
  const pick = Number(trimmed.replace(/[^\d]/g, ''));
  if (offered.length > 0 && pick >= 1 && pick <= offered.length) {
    const at = new Date(offered[pick - 1]);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'scheduled', appointmentAt: at },
    });
    return {
      text: he.leadBotConfirmed.replace('{slot}', formatSlot(at)),
      booked: { name: lead.name || phone, phone, at },
    };
  }

  // Anything else: (re-)offer slots.
  const slots = upcomingSlots();
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: 'greeted', botState: { offeredSlots: slots.map((s) => s.toISOString()) } },
  });
  return { text: slotListMessage(lead.name, slots) };
}
