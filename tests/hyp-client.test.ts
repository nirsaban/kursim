import { describe, expect, it, vi } from 'vitest';
import {
  agorotToAmount,
  createPaymentPage,
  isPaid,
  isTestTerminal,
  parseHypResponse,
  verifyTransaction,
} from '@/lib/hyp/client';

const CREDS = { masof: '0010345518', key: 'test-key', passp: 'test-pass' };

/** A signed APISign/SIGN response, taken from Hyp's own documentation. */
const SIGNED =
  'Amount=10&ClientLName=Parkington&ClientName=Jenny&Masof=0010345518&Order=12345678910&PageLang=ENG&Sign=True&UserId=203269535&action=pay&cell=0504999999&city=Rishon%20LeZion&email=jennyp%40example.co.il&street=HaDekel%2014&tmp=2&signature=0806fe45b00f11d4b3f3392d894fbfe8be372bb3822ae83fef87831c7c35426a';

function mockFetch(body: string) {
  return vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
}

/** The URL the client actually called, for asserting on parameters. */
function calledUrl(f: typeof fetch): URL {
  return new URL((f as unknown as { mock: { calls: [string][] } }).mock.calls[0][0]);
}

describe('parseHypResponse', () => {
  it('reads Hyp query-string responses', () => {
    expect(parseHypResponse('CCode=0')).toEqual({ CCode: '0' });
    expect(parseHypResponse(' Id=408941655&CCode=0&Amount=10 ').Amount).toBe('10');
  });

  it('decodes percent-encoded values', () => {
    expect(parseHypResponse('email=jennyp%40example.co.il').email).toBe('jennyp@example.co.il');
  });
});

describe('agorotToAmount', () => {
  it('converts agorot to the major units Hyp expects', () => {
    expect(agorotToAmount(1000)).toBe('10.00');
    expect(agorotToAmount(4956)).toBe('49.56');
    expect(agorotToAmount(0)).toBe('0.00');
  });
});

describe('isTestTerminal', () => {
  it('spots a test terminal by its number', () => {
    expect(isTestTerminal('0010012345')).toBe(true);
    expect(isTestTerminal('0010345518')).toBe(false);
  });
});

describe('createPaymentPage', () => {
  it('returns the redirect URL with the signed response appended verbatim', async () => {
    const f = mockFetch(SIGNED);
    const r = await createPaymentPage(CREDS, { Amount: '10', Order: 'abc' }, f);
    expect(r.ok).toBe(true);
    // Byte-for-byte: Hyp signed this exact string in this exact order.
    expect(r.ok && r.url).toBe(`https://pay.hyp.co.il/p/?${SIGNED}`);
  });

  it('always requests a signature — without it the redirect cannot be verified', async () => {
    const f = mockFetch(SIGNED);
    await createPaymentPage(CREDS, { Amount: '10' }, f);
    const u = calledUrl(f);
    expect(u.searchParams.get('action')).toBe('APISign');
    expect(u.searchParams.get('What')).toBe('SIGN');
    expect(u.searchParams.get('Sign')).toBe('True');
  });

  it('sends credentials and forces UTF-8 so Hebrew survives', async () => {
    const f = mockFetch(SIGNED);
    await createPaymentPage(CREDS, { Info: 'קורס בישול' }, f);
    const u = calledUrl(f);
    expect(u.searchParams.get('Masof')).toBe('0010345518');
    expect(u.searchParams.get('KEY')).toBe('test-key');
    expect(u.searchParams.get('PassP')).toBe('test-pass');
    expect(u.searchParams.get('UTF8')).toBe('True');
    expect(u.searchParams.get('UTF8out')).toBe('True');
    expect(u.searchParams.get('Info')).toBe('קורס בישול');
  });

  it('reports the error code when Hyp refuses to sign', async () => {
    const r = await createPaymentPage(CREDS, { Amount: '10' }, mockFetch('CCode=902'));
    expect(r).toEqual({ ok: false, ccode: '902', raw: 'CCode=902' });
  });

  it('treats an unrecognisable body as a failure rather than a payment URL', async () => {
    const r = await createPaymentPage(CREDS, { Amount: '10' }, mockFetch('<html>502</html>'));
    expect(r.ok).toBe(false);
  });

  it('does not let a caller override the action or drop the signature', async () => {
    const f = mockFetch(SIGNED);
    await createPaymentPage(CREDS, { action: 'soft', Sign: 'False' } as Record<string, string>, f);
    const u = calledUrl(f);
    expect(u.searchParams.get('action')).toBe('APISign');
    expect(u.searchParams.get('Sign')).toBe('True');
  });
});

describe('verifyTransaction', () => {
  const REDIRECT =
    'Id=408941655&CCode=0&Amount=10&ACode=0505293&Order=12345678910&Fild1=Jenny%20Parkington&Fild2=jennyp%40example.co.il&Fild3=&Sign=a84b11187377554427f267a9139ad4fd7daf7fb661dd668a9b954cf41cd25904';

  it('confirms a genuine transaction', async () => {
    const r = await verifyTransaction(CREDS, REDIRECT, mockFetch('CCode=0'));
    expect(r.ok).toBe(true);
    expect(r.ccode).toBe('0');
  });

  it('passes the redirect parameters through untouched and in order', async () => {
    const f = mockFetch('CCode=0');
    await verifyTransaction(CREDS, REDIRECT, f);
    const url = (f as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    // Hyp matches on exact order/encoding, so the tail must be the raw query.
    expect(url.endsWith(`&${REDIRECT}`)).toBe(true);
    expect(url).toContain('What=VERIFY');
  });

  it('tolerates a leading question mark from url.search', async () => {
    const f = mockFetch('CCode=0');
    await verifyTransaction(CREDS, `?${REDIRECT}`, f);
    const url = (f as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(url).not.toContain('&?');
  });

  it('rejects a tampered or unknown transaction', async () => {
    const r = await verifyTransaction(CREDS, REDIRECT, mockFetch('CCode=999'));
    expect(r.ok).toBe(false);
    expect(r.ccode).toBe('999');
  });
});

describe('isPaid', () => {
  it('accepts only a completed charge', () => {
    expect(isPaid('0')).toBe(true);
  });

  it('rejects authorizations that are not yet money', () => {
    // 700 = J5 authorization, 800 = postponed. Neither has been charged.
    expect(isPaid('700')).toBe(false);
    expect(isPaid('800')).toBe(false);
    expect(isPaid('999')).toBe(false);
  });
});
