import { describe, expect, it } from 'vitest';
import {
  canPublishLanding,
  checkStudentSeats,
  getPackages,
  normalizePlan,
} from '@/lib/billing';
import { upcomingSlots, slotListMessage } from '@/lib/lead-bot';

describe('plans', () => {
  it('normalizes unknown values to FREE', () => {
    expect(normalizePlan(undefined)).toBe('FREE');
    expect(normalizePlan('nonsense')).toBe('FREE');
    expect(normalizePlan('GROWTH')).toBe('GROWTH');
  });

  it('FREE cannot add students at all — the paywall moment', () => {
    const v = checkStudentSeats('FREE', 0, 1);
    expect(v).toEqual({ ok: false, error: 'plan_required', cap: 0 });
  });

  it('STARTER allows up to 50, then plan_limit', () => {
    expect(checkStudentSeats('STARTER', 49, 1).ok).toBe(true);
    expect(checkStudentSeats('STARTER', 50, 1)).toMatchObject({ ok: false, error: 'plan_limit' });
  });

  it('bulk adds are counted against the cap as a whole', () => {
    expect(checkStudentSeats('STARTER', 45, 5).ok).toBe(true);
    expect(checkStudentSeats('STARTER', 45, 6).ok).toBe(false);
  });

  it('UNLIMITED never caps', () => {
    expect(checkStudentSeats('UNLIMITED', 1_000_000, 500).ok).toBe(true);
  });

  it('only FREE is blocked from publishing a landing page', () => {
    expect(canPublishLanding('FREE')).toBe(false);
    expect(canPublishLanding('STARTER')).toBe(true);
  });

  it('exposes exactly the three sellable packages', () => {
    expect(getPackages().map((p) => p.plan)).toEqual(['STARTER', 'GROWTH', 'UNLIMITED']);
  });
});

describe('lead bot slots', () => {
  it('every slot is strictly in the future, starting tomorrow (Israel time)', () => {
    // 21:46 UTC = past midnight in Israel — the case that used to slip a day back.
    const now = new Date('2026-08-16T21:46:00Z');
    for (const s of upcomingSlots(now)) {
      expect(s.getTime()).toBeGreaterThan(now.getTime() + 8 * 3_600_000);
    }
  });

  it('offers six slots, never on Friday or Saturday (Israel time)', () => {
    const slots = upcomingSlots(new Date('2026-08-17T08:00:00Z')); // a Monday
    expect(slots).toHaveLength(6);
    for (const s of slots) {
      const weekday = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'Asia/Jerusalem',
      }).format(s);
      expect(['Fri', 'Sat']).not.toContain(weekday);
    }
  });

  it('slots land on the advertised Israel hours', () => {
    const slots = upcomingSlots(new Date('2026-08-17T08:00:00Z'));
    for (const s of slots) {
      const hour = Number(
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'Asia/Jerusalem',
        }).format(s),
      );
      expect([10, 16]).toContain(hour);
    }
  });

  it('numbered list renders one line per slot', () => {
    const slots = upcomingSlots(new Date('2026-08-17T08:00:00Z'));
    const msg = slotListMessage('דנה', slots);
    expect(msg).toContain('דנה');
    for (let i = 1; i <= 6; i++) expect(msg).toContain(`${i}. `);
  });
});

describe('cal.com payload parsing', async () => {
  const { attendeePhone, attendeeName } = await import('@/lib/calcom');

  it('reads the attendee phone and normalizes it', () => {
    expect(attendeePhone({ attendees: [{ phoneNumber: '050-123-4567' }] })).toBe('972501234567');
  });

  it('reads wrapped form responses', () => {
    expect(
      attendeePhone({ responses: { phone: { label: 'טלפון', value: '0521111111' } } }),
    ).toBe('972521111111');
  });

  it('takes the location answer only when the attendee chose a phone call', () => {
    expect(
      attendeePhone({ responses: { location: { value: { value: 'phone', optionValue: '0533333333' } } } }),
    ).toBe('972533333333');
    // Host-phone location must NOT match — it is the host's own number.
    expect(
      attendeePhone({ responses: { location: { value: { value: 'userPhone', optionValue: '' } } } }),
    ).toBeNull();
  });

  it('returns null when nothing usable is present', () => {
    expect(attendeePhone({ attendees: [{ name: 'דנה' }] })).toBeNull();
    expect(attendeeName({ attendees: [{ name: '  דנה  ' }] })).toBe('דנה');
  });
});

describe('mentor gating', async () => {
  const { planHasMentor } = await import('@/lib/billing');

  it('is a GROWTH-and-up feature', () => {
    expect(planHasMentor('FREE')).toBe(false);
    expect(planHasMentor('STARTER')).toBe(false);
    expect(planHasMentor('GROWTH')).toBe(true);
    expect(planHasMentor('UNLIMITED')).toBe(true);
  });
});

describe('mentor cost accounting', async () => {
  const { usageCents, currentMonth } = await import('@/lib/mentor');

  it('prices gemini-2.5-flash tokens correctly ($0.30/$2.50 per 1M)', () => {
    expect(usageCents(1_000_000, 0)).toBeCloseTo(30);
    expect(usageCents(0, 1_000_000)).toBeCloseTo(250);
    // A typical answer: ~6k in, ~300 out ≈ a fifth of a cent.
    expect(usageCents(6_000, 300)).toBeCloseTo(0.255, 3);
  });

  it('$10 budget covers thousands of typical answers', () => {
    const perAnswer = usageCents(6_000, 300);
    expect(Math.floor(1000 / perAnswer)).toBeGreaterThan(3000);
  });

  it('month key is stable calendar format', () => {
    expect(currentMonth(new Date('2026-08-17T10:00:00Z'))).toBe('2026-08');
  });
});
