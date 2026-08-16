'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { darkenHex, type Branding } from '@/lib/validation/branding';

const DEFAULTS: Branding = { logo: null, logoSize: 36, primary: null };

/** Downscale an uploaded image to a small square-ish data URL for the logo. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 256;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

export default function BrandingStudio() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/settings/branding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setBranding(d.branding);
          setTenantName(d.tenantName);
        } else setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) return <p className="text-sm text-danger font-medium">{he.loadFailed}</p>;
  if (!branding) return <div className="h-96 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function save(next: Branding) {
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await apiFetch('/api/settings/branding', {
      method: 'PATCH',
      body: JSON.stringify(next),
    });
    setBusy(false);
    if (res.ok) setSaved(true);
    else setError(he.error);
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const logo = await fileToLogoDataUrl(file);
      if (logo.length > 400_000) {
        setError(he.brandingLogoTooBig);
        return;
      }
      setBranding((b) => (b ? { ...b, logo } : b));
    } catch {
      setError(he.error);
    } finally {
      e.target.value = '';
    }
  }

  const primary = branding.primary ?? '#12151D';
  const heroFrom = branding.primary ? darkenHex(branding.primary, 0.55) : '#12151D';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[4fr,5fr] gap-6 items-start">
      {/* Controls */}
      <div className="space-y-6">
        <Card>
          <CardHeader title={he.brandingLogo} subtitle={he.brandingLogoHint} />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="w-20 h-20 rounded-2xl border border-line bg-paper grid place-items-center overflow-hidden shrink-0">
                {branding.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logo} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-2xl" aria-hidden>
                    🎓
                  </span>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  {he.brandingUpload}
                </Button>
                {branding.logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBranding({ ...branding, logo: null })}
                  >
                    {he.brandingRemoveLogo}
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
            </div>

            <Field label={`${he.brandingLogoSize} — ${branding.logoSize}px`}>
              <input
                type="range"
                min={24}
                max={64}
                step={2}
                value={branding.logoSize}
                onChange={(e) => setBranding({ ...branding, logoSize: Number(e.target.value) })}
                className="w-full accent-copper-500"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={he.brandingPrimary} subtitle={he.brandingPrimaryHint} />
          <CardBody>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={branding.primary ?? '#12151D'}
                onChange={(e) => setBranding({ ...branding, primary: e.target.value })}
                className="w-11 h-11 rounded-xl border border-line cursor-pointer bg-card p-1"
                aria-label={he.brandingPrimary}
              />
              <Input
                dir="ltr"
                className="!w-36 text-center font-mono"
                value={branding.primary ?? ''}
                placeholder="#2563eb"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '') setBranding({ ...branding, primary: null });
                  else if (/^#[0-9a-fA-F]{6}$/.test(v)) setBranding({ ...branding, primary: v });
                }}
              />
              {branding.primary && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBranding({ ...branding, primary: null })}
                >
                  {he.brandingPrimaryClear}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => save(branding)}>
            {he.save}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setBranding(DEFAULTS);
              save(DEFAULTS);
            }}
          >
            ↺ {he.brandingReset}
          </Button>
          {saved && <span className="text-sm font-medium text-ok">{he.saved} ✓</span>}
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
        </div>
      </div>

      {/* Live preview — a miniature of the student home that repaints as you edit */}
      <div className="lg:sticky lg:top-24">
        <p className="kicker mb-3">{he.brandingPreview}</p>
        <div className="rounded-xl2 border border-line shadow-lift overflow-hidden bg-paper">
          {/* Mini navbar */}
          <div className="bg-card/95 border-b border-line px-4 h-12 flex items-center gap-2.5">
            <span
              className="rounded-lg border border-line bg-paper grid place-items-center overflow-hidden shrink-0"
              style={{ width: branding.logoSize, height: branding.logoSize }}
            >
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt="" className="max-w-full max-h-full object-contain" />
              ) : (
                <span aria-hidden>🎓</span>
              )}
            </span>
            <span className="font-display font-bold text-sm truncate">{tenantName}</span>
            <span className="ms-auto flex gap-1.5">
              <span className="h-2 w-10 rounded-full bg-ink/10" />
              <span className="h-2 w-8 rounded-full bg-ink/10" />
            </span>
          </div>
          {/* Mini hero */}
          <div
            className="m-4 rounded-xl p-4 text-white"
            style={{ background: `linear-gradient(120deg, ${heroFrom}, ${primary})` }}
          >
            <div className="h-2 w-16 rounded-full bg-white/40 mb-2" />
            <div className="h-3 w-36 rounded-full bg-white/80 mb-4" />
            <div className="bg-card rounded-lg p-3 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-paper grid place-items-center text-sm">▶</span>
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-24 rounded-full bg-ink/15" />
                <div className="h-2 w-16 rounded-full bg-ink/10" />
              </div>
              <span
                className="text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                style={{ background: primary }}
              >
                {he.continueWatching}
              </span>
            </div>
          </div>
          {/* Mini cards */}
          <div className="px-4 pb-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-line rounded-lg p-2.5 space-y-1.5">
                <div className="h-1.5 w-10 rounded-full bg-ink/10" />
                <div className="h-2.5 w-6 rounded-full" style={{ background: `${primary}33` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
