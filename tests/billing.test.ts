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
