'use client';

import { useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { he } from '@/lib/he';

/**
 * The details Hyp's hosted page does not collect for us.
 *
 * Hyp only needs an amount — but a paid course is useless without an account,
 * and the account is built from these three fields. So we take them first,
 * create the order, and only then hand the buyer over to Hyp.
 */
export default function CheckoutForm({
  slug,
  courseId,
  accent,
}: {
  slug: string;
  courseId: string;
  accent: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/pay/hyp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, courseId, name, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        // Leave our site for Hyp's secure page. Not router.push — it's external.
        window.location.href = data.url;
        return;
      }
      setError(data.error === 'no_price' ? he.checkoutErrorNoPrice : he.checkoutError);
    } catch {
      setError(he.checkoutError);
    }
    // Only reached on failure; on success the browser is already navigating.
    setBusy(false);
  }

  return (
    <form className="grid gap-4 mt-6 text-start" onSubmit={submit}>
      <Field label={he.checkoutName}>
        <Input
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label={he.checkoutEmail} hint={he.checkoutEmailHint}>
        <Input
          required
          dir="ltr"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label={he.checkoutPhone} hint={he.checkoutPhoneHint}>
        <Input
          required
          dir="ltr"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="05X-XXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>

      <Button
        type="submit"
        variant="cta"
        size="lg"
        disabled={busy}
        className="mt-1"
        style={{ background: accent }}
      >
        {busy ? he.checkoutSubmitting : he.checkoutPay}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-danger text-center">
          {error}
        </p>
      )}
      <p className="text-xs text-muted text-center leading-relaxed">{he.checkoutSecureNote}</p>
    </form>
  );
}
