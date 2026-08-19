import { describe, it, expect } from 'vitest';
import {
  socialsSchema,
  parseSocials,
  hasSocials,
  waDigits,
  socialEntries,
  linktreeSchema,
  parseLinktree,
} from '@/lib/validation/links';

describe('parseSocials', () => {
  it('falls back to empty socials for null/garbage', () => {
    const empty = socialsSchema.parse({});
    expect(parseSocials(undefined)).toEqual(empty);
    expect(parseSocials(null)).toEqual(empty);
    expect(parseSocials({ instagram: 'not a url' })).toEqual(empty);
    expect(hasSocials(empty)).toBe(false);
  });

  it('keeps valid channels and fills the rest empty', () => {
    const s = parseSocials({ instagram: 'https://instagram.com/school', whatsapp: '050-1234567' });
    expect(s.instagram).toBe('https://instagram.com/school');
    expect(s.whatsapp).toBe('050-1234567');
    expect(s.facebook).toBe('');
    expect(hasSocials(s)).toBe(true);
  });

  it('rejects non-http urls and bad emails', () => {
    expect(socialsSchema.safeParse({ website: 'javascript:alert(1)' }).success).toBe(false);
    expect(socialsSchema.safeParse({ website: 'ftp://x.com' }).success).toBe(false);
    expect(socialsSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(socialsSchema.safeParse({ whatsapp: 'call me' }).success).toBe(false);
  });
});

describe('waDigits', () => {
  it('normalizes Israeli forms to 972 digits', () => {
    expect(waDigits('050-123-4567')).toBe('972501234567');
    expect(waDigits('0501234567')).toBe('972501234567');
    expect(waDigits('+972 50 123 4567')).toBe('972501234567');
    expect(waDigits('501234567')).toBe('972501234567');
  });

  it('passes through other international numbers and rejects junk', () => {
    expect(waDigits('14155552671')).toBe('14155552671');
    expect(waDigits('')).toBeNull();
    expect(waDigits('123')).toBeNull();
  });
});

describe('socialEntries', () => {
  it('builds wa.me and mailto hrefs and keeps order', () => {
    const entries = socialEntries(
      parseSocials({
        whatsapp: '0501234567',
        email: 'hi@school.co.il',
        tiktok: 'https://tiktok.com/@school',
      }),
    );
    expect(entries[0]).toEqual({ kind: 'whatsapp', href: 'https://wa.me/972501234567' });
    expect(entries.find((e) => e.kind === 'tiktok')?.href).toBe('https://tiktok.com/@school');
    expect(entries.at(-1)).toEqual({ kind: 'email', href: 'mailto:hi@school.co.il' });
  });

  it('skips a whatsapp number that cannot normalize', () => {
    const entries = socialEntries(parseSocials({ whatsapp: '12' }));
    expect(entries).toEqual([]);
  });
});

describe('parseLinktree', () => {
  it('falls back to defaults for null/garbage and never publishes by accident', () => {
    const empty = linktreeSchema.parse({});
    expect(parseLinktree(undefined)).toEqual(empty);
    expect(parseLinktree({ links: 'nope' })).toEqual(empty);
    expect(empty.published).toBe(false);
    expect(empty.accent).toBe('noir');
    expect(empty.buttonStyle).toBe('solid');
  });

  it('keeps valid config', () => {
    const lt = parseLinktree({
      published: true,
      headline: 'הסטודיו של אור',
      accent: 'rose',
      buttonStyle: 'soft',
      links: [{ label: 'הקורס החדש', url: 'https://example.com', emoji: '🎓' }],
    });
    expect(lt.published).toBe(true);
    expect(lt.accent).toBe('rose');
    expect(lt.links).toHaveLength(1);
    expect(lt.links[0].emoji).toBe('🎓');
  });

  it('rejects links without a valid http url, and more than 30 links', () => {
    expect(
      linktreeSchema.safeParse({ links: [{ label: 'x', url: 'javascript:alert(1)' }] }).success,
    ).toBe(false);
    expect(linktreeSchema.safeParse({ links: [{ label: 'x', url: '' }] }).success).toBe(false);
    const many = Array.from({ length: 31 }, (_, i) => ({
      label: `קישור ${i}`,
      url: 'https://example.com',
    }));
    expect(linktreeSchema.safeParse({ links: many }).success).toBe(false);
  });
});
