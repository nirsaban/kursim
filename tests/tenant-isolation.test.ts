import { describe, expect, it } from 'vitest';
import { injectTenant } from '@/lib/tenant/scoped-prisma';

const TENANT = 'tenant-a';

describe('tenant scoping injection (layer 1)', () => {
  it('injects tenantId into findMany where', () => {
    const args = injectTenant('Course', 'findMany', { where: { status: 'PUBLISHED' } }, TENANT);
    expect(args.where).toEqual({ AND: [{ tenantId: TENANT }, { status: 'PUBLISHED' }] });
  });

  it('scopes findMany even with no where clause', () => {
    const args = injectTenant('Course', 'findMany', undefined, TENANT);
    expect(args.where).toEqual({ AND: [{ tenantId: TENANT }, {}] });
  });

  it('a malicious where targeting another tenant still ANDs with the scope', () => {
    const args = injectTenant('Course', 'findMany', { where: { tenantId: 'tenant-b' } }, TENANT);
    // Contradictory AND → zero rows, never tenant-b rows.
    expect(args.where.AND).toContainEqual({ tenantId: TENANT });
    expect(args.where.AND).toContainEqual({ tenantId: 'tenant-b' });
  });

  it('forces tenantId on create', () => {
    const args = injectTenant(
      'Course',
      'create',
      { data: { title: 'x', tenantId: 'tenant-b' } },
      TENANT,
    );
    expect(args.data.tenantId).toBe(TENANT);
  });

  it('forces tenantId on every createMany row', () => {
    const args = injectTenant(
      'Lesson',
      'createMany',
      { data: [{ title: 'a' }, { title: 'b', tenantId: 'tenant-b' }] },
      TENANT,
    );
    for (const row of args.data) expect(row.tenantId).toBe(TENANT);
  });

  it('forces tenantId on upsert create', () => {
    const args = injectTenant(
      'Progress',
      'upsert',
      { where: { id: 'p1' }, create: { lastPositionSec: 1 }, update: { lastPositionSec: 2 } },
      TENANT,
    );
    expect(args.create.tenantId).toBe(TENANT);
  });

  it('scopes count/aggregate/deleteMany/updateMany', () => {
    for (const op of ['count', 'aggregate', 'deleteMany', 'updateMany']) {
      const args = injectTenant('Enrollment', op, { where: {} }, TENANT);
      expect(args.where.AND).toContainEqual({ tenantId: TENANT });
    }
  });

  it('leaves non-tenant models (Tenant) untouched', () => {
    const original = { where: { slug: 'demo' } };
    const args = injectTenant('Tenant', 'findMany', original, TENANT);
    expect(args).toEqual(original);
  });
});
