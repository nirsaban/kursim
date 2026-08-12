import { describe, expect, it } from 'vitest';
import { agorotToInput, formatAgorot, inputToAgorot } from '../src/lib/money';

describe('formatAgorot', () => {
  it('drops decimals for whole shekels', () => {
    expect(formatAgorot(34900)).toBe('349 ₪');
    expect(formatAgorot(100)).toBe('1 ₪');
  });

  it('keeps two decimals when there are agorot', () => {
    expect(formatAgorot(34990)).toBe('349.90 ₪');
    expect(formatAgorot(34901)).toBe('349.01 ₪');
  });
});

describe('inputToAgorot', () => {
  it('parses plain and decimal shekels', () => {
    expect(inputToAgorot('349')).toBe(34900);
    expect(inputToAgorot('349.9')).toBe(34990);
    expect(inputToAgorot('349.90')).toBe(34990);
    expect(inputToAgorot(' 349 ')).toBe(34900);
  });

  it('accepts a comma decimal separator', () => {
    expect(inputToAgorot('349,90')).toBe(34990);
  });

  it('rounds to whole agorot without floating-point drift', () => {
    // 0.1 + 0.2 territory: 349.35 * 100 is 34934.999... in binary floating point.
    expect(inputToAgorot('349.35')).toBe(34935);
    expect(inputToAgorot('1.15')).toBe(115);
  });

  it('treats empty and junk as "not for sale" rather than free', () => {
    expect(inputToAgorot('')).toBeNull();
    expect(inputToAgorot('   ')).toBeNull();
    expect(inputToAgorot('abc')).toBeNull();
    expect(inputToAgorot('-50')).toBeNull();
    expect(inputToAgorot('0')).toBeNull();
    // Three decimals would silently round the buyer's price — reject instead.
    expect(inputToAgorot('349.999')).toBeNull();
  });
});

describe('agorotToInput', () => {
  it('round-trips through the editor', () => {
    for (const raw of ['349', '349.90', '1', '0.50']) {
      const agorot = inputToAgorot(raw)!;
      expect(inputToAgorot(agorotToInput(agorot))).toBe(agorot);
    }
  });

  it('shows an empty field when there is no price', () => {
    expect(agorotToInput(null)).toBe('');
    expect(agorotToInput(0)).toBe('');
    expect(agorotToInput(undefined)).toBe('');
  });
});
