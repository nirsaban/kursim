'use client';

import { useState } from 'react';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { he } from '@/lib/he';

// Leads land in our own database (and kick off the WhatsApp scheduling bot);
// no dependency on an external hub that may be down.
const LEADS_ENDPOINT = '/api/leads';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function LeadForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <p className="font-display font-bold text-lg">{he.platformLeadFormSuccessTitle}</p>
        <p className="text-muted mt-1.5">{he.platformLeadFormSuccessBody}</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border border-line bg-card p-6 text-start"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus('submitting');
        try {
          const res = await fetch(LEADS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact, message, website }),
          });
          if (!res.ok) throw new Error('request_failed');
          setStatus('success');
        } catch {
          setStatus('error');
        }
      }}
    >
      <Field label={he.platformLeadFormNameLabel}>
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={he.platformLeadFormContactLabel}>
        <Input required value={contact} onChange={(e) => setContact(e.target.value)} />
      </Field>
      <Field label={he.platformLeadFormMessageLabel}>
        <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      {/* Honeypot — hidden from real visitors, bots fill every field they can see */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -z-10 h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      <Button type="submit" variant="cta" size="lg" disabled={status === 'submitting'}>
        {status === 'submitting' ? he.platformLeadFormSubmitting : he.platformLeadFormSubmit}
      </Button>
      {status === 'error' && <p className="text-sm text-danger">{he.platformLeadFormErrorBody}</p>}
    </form>
  );
}
