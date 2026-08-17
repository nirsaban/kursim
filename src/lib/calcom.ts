import { prisma } from '@/lib/tenant/prisma';
import { normalizeIlPhone } from '@/lib/whatsapp';

/**
 * Cal.com integration for platform leads (ported from the Kesher project).
 *
 * The super-admin stores a booking URL + webhook secret; the lead bot hands
 * out the URL instead of inventing meeting slots, and Cal.com reports the
 * actual booking back to /api/webhooks/calcom, HMAC-signed with the secret.
 */

export interface CalcomConfig {
  /** Public booking-page URL the bot sends to leads. Empty = not configured. */
  url: string;
  /** Webhook signing secret (Cal.com → webhook settings). */
  secret: string;
}

export async function loadCalcomConfig(): Promise<CalcomConfig> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: 'calcom' } });
    const v = (row?.value ?? {}) as Partial<CalcomConfig>;
    return { url: v.url?.trim() ?? '', secret: v.secret?.trim() ?? '' };
  } catch {
    return { url: '', secret: '' };
  }
}

export async function saveCalcomConfig(config: CalcomConfig): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: 'calcom' },
    update: { value: { ...config } },
    create: { key: 'calcom', value: { ...config } },
  });
}

// ── Booking payload parsing ──────────────────────────────────────────────────

export interface CalcomAttendee {
  name?: string;
  email?: string;
  phoneNumber?: string;
}

export interface CalcomPayload {
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendees?: CalcomAttendee[];
  responses?: Record<string, unknown>;
  location?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Cal.com sends form answers either flat or wrapped as `{ label, value }`. */
function unwrapAnswer(v: unknown): unknown {
  return isRecord(v) && 'value' in v ? v.value : v;
}

/**
 * The number the ATTENDEE gave us, normalized — or null.
 *
 * Only attendee-controlled fields count. `payload.location` is deliberately
 * NOT one of them: on an event type whose location is `userPhone`, Cal.com
 * fills it with the HOST's number on every booking, which would match every
 * lead to the host. The location answer counts only when the attendee picked
 * the "phone call" option and typed their own number.
 */
export function attendeePhone(p: CalcomPayload): string | null {
  const candidates: unknown[] = [];
  for (const a of p.attendees ?? []) candidates.push(a.phoneNumber);

  const responses = p.responses ?? {};
  candidates.push(
    unwrapAnswer(responses.attendeePhoneNumber),
    unwrapAnswer(responses.smsReminderNumber),
    unwrapAnswer(responses.phone),
  );

  const location = unwrapAnswer(responses.location);
  if (isRecord(location) && location.value === 'phone') candidates.push(location.optionValue);

  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const phone = normalizeIlPhone(c);
    if (phone) return phone;
  }
  return null;
}

export function attendeeName(p: CalcomPayload): string | null {
  return p.attendees?.[0]?.name?.trim() || null;
}
