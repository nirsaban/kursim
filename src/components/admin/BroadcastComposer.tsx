'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';

interface Course {
  id: string;
  title: string;
}

export default function BroadcastComposer({
  courses,
  onSent,
}: {
  courses: Course[];
  onSent?: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setMessage(null);

    const res = await apiFetch('/api/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        body,
        ...(audience === 'all' ? {} : { courseId: audience }),
      }),
    });

    setSending(false);
    if (res.ok) {
      const data = await res.json();
      setMessage(he.broadcastSent.replace('{n}', String(data.sent)));
      setSubject('');
      setBody('');
      setAudience('all');
      if (onSent) onSent();
      else router.refresh();
    }
  }

  return (
    <Card className="mb-8">
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <Field label={he.broadcastSubject}>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
            />
          </Field>

          <Field label={he.broadcastBody}>
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              required
            />
          </Field>

          <Field label={he.broadcastAudience}>
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">{he.broadcastAll}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="cta" disabled={sending}>
              {he.broadcastSend}
            </Button>
            {message && <p className="text-sm font-medium text-ok">{message}</p>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
