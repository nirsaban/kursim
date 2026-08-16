'use client';

import { useState } from 'react';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

/** Latin-kebab slug suggestion from a (possibly Hebrew) school name. */
function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default function SignupForm() {
  const [schoolName, setSchoolName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSchoolName(v: string) {
    setSchoolName(v);
    if (!slugTouched) setSlug(suggestSlug(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolName, slug, email, password, name }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.redirect;
      return;
    }
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (data.error === 'slug_taken') setError(he.signupSlugTaken);
    else if (data.error === 'too_many_attempts') setError(he.tooManyAttempts);
    else setError(he.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={he.signupSchoolName}>
        <Input
          value={schoolName}
          onChange={(e) => onSchoolName(e.target.value)}
          required
          minLength={2}
          maxLength={200}
          autoFocus
        />
      </Field>

      <Field label={he.signupSlug} hint={he.signupSlugHint}>
        <div className="flex items-center gap-2" dir="ltr">
          <span className="text-sm text-muted shrink-0">/t/</span>
          <Input
            dir="ltr"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={2}
            maxLength={64}
          />
        </div>
      </Field>

      <Field label={he.signupYourName}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>

      <Field label={he.email}>
        <Input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </Field>

      <Field label={he.password} hint={he.passwordHint}>
        <Input
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      <Button type="submit" variant="cta" className="w-full" disabled={busy}>
        {busy ? he.signupCreating : he.signupCta}
      </Button>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}

      <p className="text-xs text-muted pt-1">
        {he.signupHaveAccount} {he.signupLoginHint}
      </p>
    </form>
  );
}
