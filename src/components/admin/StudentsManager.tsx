'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';

interface Student {
  id: string;
  email: string;
  role: 'STUDENT' | 'INSTRUCTOR';
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  liveSessions: number;
  _count: { enrollments: number };
}
interface Session {
  sid: string;
  deviceLabel: string;
  ip: string;
  lastSeenAt: number;
}
interface Invite {
  id: string;
  email: string | null;
  role: string;
  expiresAt: string;
  usedAt: string | null;
}

export default function StudentsManager() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openSessions, setOpenSessions] = useState<{ id: string; sessions: Session[] } | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');

  const reload = useCallback(async () => {
    const [sRes, iRes] = await Promise.all([apiFetch('/api/students'), apiFetch('/api/invites')]);
    if (sRes.ok) setStudents((await sRes.json()).students);
    if (iRes.ok) setInvites((await iRes.json()).invites);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await apiFetch('/api/students', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    if (res.ok) {
      setEmail('');
      setPassword('');
      setCreateOpen(false);
      reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'email_taken' ? he.emailTaken : he.error);
    }
  }

  async function createInvite() {
    const res = await apiFetch('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ role: 'STUDENT', expiresInHours: 72 }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.url);
      setCopied(false);
      reload();
    }
  }

  async function setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    await apiFetch(`/api/students/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    reload();
  }

  async function removeStudent(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/students/${id}`, { method: 'DELETE' });
    reload();
  }

  async function resetPassword(id: string) {
    const pw = prompt(he.newPassword);
    if (!pw || pw.length < 8) return;
    const res = await apiFetch(`/api/students/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) alert(he.saved);
  }

  async function showSessions(id: string) {
    const res = await apiFetch(`/api/students/${id}/sessions`);
    if (res.ok) setOpenSessions({ id, sessions: (await res.json()).sessions });
  }

  async function killSession(studentId: string, sid: string) {
    await apiFetch(`/api/students/${studentId}/sessions/${sid}`, { method: 'DELETE' });
    showSessions(studentId);
    reload();
  }

  if (!students) {
    return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setCreateOpen(true)}>+ {he.newStudent}</Button>
        <Button variant="secondary" onClick={createInvite}>
          🔗 {he.newInvite}
        </Button>
      </div>

      {inviteUrl && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl2 p-4 text-sm space-y-2">
          <p className="text-brand-900 font-medium">{he.inviteLinkNote}</p>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="bg-card border border-brand-200 rounded-lg px-3 py-2 text-xs break-all flex-1"
            >
              {inviteUrl}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
              }}
            >
              {copied ? he.copied : he.copy}
            </Button>
          </div>
        </div>
      )}

      {students.length === 0 ? (
        <EmptyState
          icon="🧑‍🎓"
          title={he.noStudentsYet}
          hint={he.studentsEmptyHint}
          action={<Button onClick={() => setCreateOpen(true)}>+ {he.newStudent}</Button>}
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{he.email}</Th>
                <Th>{he.role}</Th>
                <Th>{he.status}</Th>
                <Th>{he.enrolledCourses}</Th>
                <Th>{he.liveSessions}</Th>
                <Th>{he.lastLogin}</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-paper/60 transition-colors">
                  <Td dir="ltr">{s.email}</Td>
                  <Td>
                    <Badge tone={s.role === 'INSTRUCTOR' ? 'brand' : 'neutral'}>
                      {s.role === 'STUDENT' ? he.student : he.instructor}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={s.status === 'ACTIVE' ? 'ok' : 'danger'} dot>
                      {s.status === 'ACTIVE' ? he.active : he.suspended}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums">{s._count.enrollments}</Td>
                  <Td>
                    {s.liveSessions > 0 ? (
                      <button
                        onClick={() => showSessions(s.id)}
                        className="text-brand-700 font-semibold hover:underline"
                      >
                        {s.liveSessions} · {he.viewSessions}
                      </button>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </Td>
                  <Td className="text-muted tabular-nums" dir="ltr">
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('he-IL') : '—'}
                  </Td>
                  <Td className="text-end whitespace-nowrap">
                    <button
                      onClick={() => setStatus(s.id, s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      className="text-xs font-medium text-warn hover:underline me-3"
                    >
                      {s.status === 'ACTIVE' ? he.suspend : he.activate}
                    </button>
                    <button
                      onClick={() => resetPassword(s.id)}
                      className="text-xs font-medium text-brand-700 hover:underline me-3"
                    >
                      {he.resetPassword}
                    </button>
                    <button
                      onClick={() => removeStudent(s.id)}
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

      {invites.length > 0 && (
        <Card>
          <CardHeader title={he.invites} />
          <ul className="divide-y divide-line/70 text-sm">
            {invites.map((inv) => (
              <li key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <span>
                  {inv.email ?? he.anyEmail} ·{' '}
                  {inv.role === 'STUDENT' ? he.student : he.instructor}
                </span>
                {inv.usedAt ? (
                  <Badge tone="ok">{he.inviteUsed} ✓</Badge>
                ) : (
                  <span className="text-xs text-muted tabular-nums" dir="ltr">
                    {he.inviteExpires}: {new Date(inv.expiresAt).toLocaleDateString('he-IL')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Create student modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={he.newStudent}>
        <form onSubmit={createStudent} className="space-y-4">
          <Field label={he.email}>
            <Input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={he.password} hint={he.newStudentPasswordHint}>
            <Input
              type="text"
              required
              minLength={8}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label={he.role}>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as 'STUDENT' | 'INSTRUCTOR')}
            >
              <option value="STUDENT">{he.student}</option>
              <option value="INSTRUCTOR">{he.instructor}</option>
            </Select>
          </Field>
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit">{he.create}</Button>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              {he.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sessions modal */}
      <Modal
        open={openSessions !== null}
        onClose={() => setOpenSessions(null)}
        title={he.liveSessions}
      >
        {openSessions && (
          <>
            {openSessions.sessions.length === 0 ? (
              <p className="text-sm text-muted">{he.noLiveSessions}</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {openSessions.sessions.map((sess) => (
                  <li key={sess.sid} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{sess.deviceLabel || he.device}</div>
                      <div className="text-xs text-muted tabular-nums" dir="ltr">
                        {sess.ip} · {new Date(sess.lastSeenAt).toLocaleString('he-IL')}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => killSession(openSessions.id, sess.sid)}
                    >
                      {he.killSession}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
