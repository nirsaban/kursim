'use client';

import { useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { formatAgorot } from '@/lib/money';
import type { CourseOffer } from '@/lib/pay/offer';
import { he } from '@/lib/he';

/**
 * The details Hyp's hosted page does not collect for us, plus the basket.
 *
 * Hyp only needs an amount — but a paid course is useless without an account,
 * and the account is built from these three fields. So we take them first,
 * create the order, and only then hand the buyer over to Hyp.
 *
 * The total shown here is arithmetic on prices the server sent; the server
 * prices the order again from its own data when the form is submitted. This
 * side is display, never authority.
 */
export default function CheckoutForm({
  slug,
  courseId,
  accent,
  offer,
  initialAddons = [],
}: {
  slug: string;
  courseId: string;
  accent: string;
  offer: CourseOffer;
  initialAddons?: string[];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<string[]>(initialAddons);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total =
    offer.baseAgorot +
    offer.addons.filter((a) => picked.includes(a.id)).reduce((sum, a) => sum + a.priceAgorot, 0);

  const toggleAddon = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/pay/hyp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, courseId, name, email, phone, addonCourseIds: picked }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        // Leave our site for Hyp's secure page. Not router.push — it's external.
        window.location.href = data.url;
        return;
      }
      if (data.error === 'no_price') setError(he.checkoutErrorNoPrice);
      // The offer changed under an open tab — a reload gets the current one.
      else if (data.error === 'bad_addon') setError(he.checkoutErrorStale);
      else setError(he.checkoutError);
    } catch {
      setError(he.checkoutError);
    }
    // Only reached on failure; on success the browser is already navigating.
    setBusy(false);
  }

  return (
    <form className="grid gap-4 mt-6 text-start" onSubmit={submit}>
      <div className="rounded-xl border border-line bg-paper p-4">
        <p className="text-xs font-semibold text-muted">{he.checkoutIncludes}</p>
        <ul className="mt-2 space-y-1.5">
          {offer.includedTitles.map((title) => (
            <li key={title} className="flex items-start gap-2 text-sm font-medium">
              <span aria-hidden style={{ color: accent }}>
                ✓
              </span>
              <span>{title}</span>
            </li>
          ))}
        </ul>

        {offer.addons.length > 0 && (
          <div className="mt-4 pt-3 border-t border-line">
            <p className="text-xs font-semibold text-muted">{he.checkoutAddonsTitle}</p>
            <div className="mt-2 space-y-2">
              {offer.addons.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2.5 text-sm cursor-pointer rounded-lg border border-line bg-card px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(a.id)}
                    onChange={() => toggleAddon(a.id)}
                    className="size-4 shrink-0"
                    style={{ accentColor: accent }}
                  />
                  <span className="flex-1 font-medium">{a.title}</span>
                  <span className="font-semibold whitespace-nowrap" style={{ color: accent }}>
                    {he.checkoutAddonPlus.replace('{price}', formatAgorot(a.priceAgorot))}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-line">
          <span className="text-sm text-muted">{he.checkoutTotal}</span>
          <span className="flex items-baseline gap-2">
            {/* Only meaningful before add-ons: it compares the bundle price
                against what the bundled courses cost separately. */}
            {offer.strikeAgorot !== null && picked.length === 0 && (
              <span className="text-sm text-muted line-through">
                {formatAgorot(offer.strikeAgorot)}
              </span>
            )}
            <span className="font-display text-xl font-black" style={{ color: accent }}>
              {formatAgorot(total)}
            </span>
          </span>
        </div>
      </div>

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
        {busy && (
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-card border-t-transparent animate-spin"
          />
        )}
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
