import { describe, expect, it } from 'vitest';
import { injectTenant } from '@/lib/tenant/scoped-prisma';
import { renderTemplate } from '@/lib/automations';
import { hashApiKey } from '@/lib/api-keys';
import {
  brandingSchema,
  darkenHex,
  parseBranding,
  parseTerms,
  termsGateBlocks,
} from '@/lib/validation/branding';

const TENANT = 'tenant-a';

describe('new tenant-owned models are scoped (layer 1)', () => {
  it.each(['EmailAutomation', 'AutomationSend', 'ApiKey'] as const)(
    '%s findMany gets the tenant filter',
    (model) => {
      const args = injectTenant(model, 'findMany', { where: {} }, TENANT);
      expect(args.where.AND).toContainEqual({ tenantId: TENANT });
    },
  );

  it.each(['EmailAutomation', 'AutomationSend', 'ApiKey'] as const)(
    '%s create is forced into the tenant',
    (model) => {
      const args = injectTenant(model, 'create', { data: { tenantId: 'tenant-b' } }, TENANT);
      expect(args.data.tenantId).toBe(TENANT);
    },
  );
});

describe('automation templates', () => {
  it('substitutes known variables and blanks unknown ones', () => {
    const out = renderTemplate('שלום {{name}}, ברוכים הבאים ל{{org_name}}! {{nope}}', {
      name: 'דנה',
      org_name: 'הסטודיו',
    });
    expect(out).toBe('שלום דנה, ברוכים הבאים להסטודיו! ');
  });

  it('tolerates spaces inside the braces', () => {
    expect(renderTemplate('{{ days }} ימים', { days: '3' })).toBe('3 ימים');
  });
});

describe('api keys', () => {
  it('hashes deterministically and never stores the plaintext form', () => {
    const key = 'ksk_test-key';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toContain(key);
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('branding', () => {
  it('falls back to defaults on garbage input', () => {
    expect(parseBranding({ logo: 'javascript:alert(1)', primary: 'red' })).toEqual({
      logo: null,
      logoSize: 36,
      primary: null,
    });
  });

  it('accepts a valid config', () => {
    const b = brandingSchema.parse({
      logo: 'data:image/png;base64,AAAA',
      logoSize: 48,
      primary: '#2563eb',
    });
    expect(b.primary).toBe('#2563eb');
  });

  it('rejects a non-data-URL logo', () => {
    expect(brandingSchema.safeParse({ logo: 'https://evil.example/x.png' }).success).toBe(false);
  });

  it('darkens toward black', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('#808080');
    expect(darkenHex('#000000', 0.5)).toBe('#000000');
  });
});

describe('terms gate', () => {
  const accepted = { acceptedTermsAt: new Date(), acceptedTermsVersion: 1 };
  const never = { acceptedTermsAt: null, acceptedTermsVersion: 0 };

  it('never blocks when disabled', () => {
    const terms = parseTerms({ enabled: false, version: 5 });
    expect(termsGateBlocks(terms, never)).toBe(false);
  });

  it('blocks a student who never accepted', () => {
    const terms = parseTerms({ enabled: true, version: 1 });
    expect(termsGateBlocks(terms, never)).toBe(true);
  });

  it('lets an accepted student through', () => {
    const terms = parseTerms({ enabled: true, version: 1 });
    expect(termsGateBlocks(terms, accepted)).toBe(false);
  });

  it('re-blocks everyone when the version is bumped', () => {
    const terms = parseTerms({ enabled: true, version: 2 });
    expect(termsGateBlocks(terms, accepted)).toBe(true);
  });

  it('parses garbage into safe defaults (gate off)', () => {
    expect(parseTerms('nonsense').enabled).toBe(false);
  });
});
