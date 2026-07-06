'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Field';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  sessionLimit: number;
  evictionPolicy: 'BLOCK' | 'EVICT_OLDEST';
  _count: { users: number; courses: number };
}

export default function TenantsManager() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    ownerEmail: '',
    ownerPassword: '',
  });

  const reload = useCallback(async () => {
    const res = await apiFetch('/api/tenants');
    if (res.ok) setTenants((await res.json()).tenants);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ slug: '', name: '', ownerEmail: '', ownerPassword: '' });
      setShowForm(false);
      reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'slug_taken' ? he.slugTaken : he.error);
    }
  }

  async function setStatus(tenant: Tenant, status: 'ACTIVE' | 'SUSPENDED') {
    await apiFetch(`/api/tenants/${tenant.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function removeTenant(tenant: Tenant) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/tenants/${tenant.id}`, { method: 'DELETE' });
    reload();
  }

  if (!tenants) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-6">
      <Button onClick={() => setShowForm(true)}>+ {he.newTenant}</Button>

      {tenants.length === 0 ? (
        <EmptyState icon="🏫" title={he.none} hint="צרו את בית הספר הראשון בפלטפורמה" />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{he.tenantName}</Th>
                <Th>{he.tenantSlug}</Th>
                <Th>{he.status}</Th>
                <Th>{he.usersCount}</Th>
                <Th>{he.coursesCount}</Th>
                <Th>{he.sessionLimit}</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-paper/60 transition-colors">
                  <Td className="font-semibold">{t.name}</Td>
                  <Td dir="ltr">
                    <a
                      href={`/t/${t.slug}/login`}
                      target="_blank"
                      className="text-brand-700 hover:underline"
                    >
                      /t/{t.slug}
                    </a>
                  </Td>
                  <Td>
                    <Badge tone={t.status === 'ACTIVE' ? 'ok' : 'danger'} dot>
                      {t.status === 'ACTIVE' ? he.active : he.suspended}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums">{t._count.users}</Td>
                  <Td className="tabular-nums">{t._count.courses}</Td>
                  <Td className="tabular-nums">{t.sessionLimit}</Td>
                  <Td className="text-end whitespace-nowrap">
                    <button
                      onClick={() => setStatus(t, t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      className="text-xs font-medium text-warn hover:underline me-3"
                    >
                      {t.status === 'ACTIVE' ? he.suspend : he.activate}
                    </button>
                    <button
                      onClick={() => removeTenant(t)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      {he.delete}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={he.newTenant}>
        <form onSubmit={createTenant} className="space-y-4">
          <Field label={he.tenantSlug} hint="אותיות לועזיות קטנות ומקפים בלבד — יופיע בכתובת">
            <Input
              required
              dir="ltr"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </Field>
          <Field label={he.tenantName}>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={he.ownerEmail}>
            <Input
              required
              type="email"
              dir="ltr"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            />
          </Field>
          <Field label={he.ownerPassword} hint="הבעלים יתבקש להחליף סיסמה בכניסה הראשונה">
            <Input
              required
              type="text"
              minLength={8}
              dir="ltr"
              value={form.ownerPassword}
              onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
            />
          </Field>
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit">{he.create}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              {he.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
