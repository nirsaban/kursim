'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { fileToLogoDataUrl } from '@/lib/client/logo';
import type { Branding } from '@/lib/validation/branding';
import { he } from '@/lib/he';
import { cn } from '@/lib/cn';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { LANDING_THEMES } from '@/lib/landing-themes';
import {
  LINKTREE_BUTTON_STYLES,
  type Linktree,
  type LinktreeButtonStyle,
  type Socials,
} from '@/lib/validation/links';
import type { LandingAccent } from '@/lib/validation/marketing';

const SOCIAL_FIELDS: Array<{ key: keyof Socials; label: string; placeholder: string }> = [
  { key: 'whatsapp', label: he.socialWhatsapp, placeholder: '050-0000000' },
  { key: 'instagram', label: he.socialInstagram, placeholder: he.socialsUrlPlaceholder },
  { key: 'facebook', label: he.socialFacebook, placeholder: he.socialsUrlPlaceholder },
  { key: 'tiktok', label: he.socialTiktok, placeholder: he.socialsUrlPlaceholder },
  { key: 'youtube', label: he.socialYoutube, placeholder: he.socialsUrlPlaceholder },
  { key: 'linkedin', label: he.socialLinkedin, placeholder: he.socialsUrlPlaceholder },
  { key: 'website', label: he.socialWebsite, placeholder: he.socialsUrlPlaceholder },
  { key: 'email', label: he.socialEmail, placeholder: 'hello@example.com' },
];

const BUTTON_STYLE_LABELS: Record<LinktreeButtonStyle, string> = {
  solid: he.linktreeButtonSolid,
  outline: he.linktreeButtonOutline,
  soft: he.linktreeButtonSoft,
};

export default function LinksStudio({ slug }: { slug: string }) {
  const [socials, setSocials] = useState<Socials | null>(null);
  const [linktree, setLinktree] = useState<Linktree | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<'socials' | 'linktree' | 'logo' | null>(null);
  const [savedAt, setSavedAt] = useState<'socials' | 'linktree' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/settings/socials').then((r) => (r.ok ? r.json() : null)),
      apiFetch('/api/settings/linktree').then((r) => (r.ok ? r.json() : null)),
      apiFetch('/api/settings/branding').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, l, b]) => {
        if (s && l && b) {
          setSocials(s.socials);
          setLinktree(l.linktree);
          setBranding(b.branding);
        } else setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) return <p className="text-sm text-danger font-medium">{he.loadFailed}</p>;
  if (!socials || !linktree || !branding)
    return <div className="h-96 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function saveSocials() {
    setBusy('socials');
    setSavedAt(null);
    setError(null);
    const res = await apiFetch('/api/settings/socials', {
      method: 'PATCH',
      body: JSON.stringify(socials),
    });
    setBusy(null);
    if (res.ok) setSavedAt('socials');
    else setError(he.error);
  }

  async function saveLinktree(next?: Linktree) {
    const payload = next ?? linktree!;
    // Half-filled rows can't pass the server schema — drop them quietly.
    const clean = { ...payload, links: payload.links.filter((l) => l.label.trim() && l.url.trim()) };
    setBusy('linktree');
    setSavedAt(null);
    setError(null);
    const res = await apiFetch('/api/settings/linktree', {
      method: 'PATCH',
      body: JSON.stringify(clean),
    });
    setBusy(null);
    if (res.ok) {
      setLinktree(clean);
      setSavedAt('linktree');
    } else setError(he.error);
  }

  async function saveLogo(logo: string | null) {
    setBusy('logo');
    setError(null);
    const next = { ...branding!, logo };
    const res = await apiFetch('/api/settings/branding', {
      method: 'PATCH',
      body: JSON.stringify(next),
    });
    setBusy(null);
    if (res.ok) setBranding(next);
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
      await saveLogo(logo);
    } catch {
      setError(he.error);
    } finally {
      e.target.value = '';
    }
  }

  const publicPath = `/t/${slug}/links`;

  function copyUrl() {
    navigator.clipboard.writeText(`${window.location.origin}${publicPath}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function patchLink(i: number, patch: Partial<Linktree['links'][number]>) {
    setLinktree((lt) =>
      lt ? { ...lt, links: lt.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : lt,
    );
  }

  function moveLink(i: number, dir: -1 | 1) {
    setLinktree((lt) => {
      if (!lt) return lt;
      const j = i + dir;
      if (j < 0 || j >= lt.links.length) return lt;
      const links = [...lt.links];
      [links[i], links[j]] = [links[j], links[i]];
      return { ...lt, links };
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Social channels ─────────────────────────────────────── */}
      <Card>
        <CardHeader title={he.socialsCardTitle} subtitle={he.socialsCardSubtitle} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SOCIAL_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                hint={f.key === 'whatsapp' ? he.socialsWhatsappHint : undefined}
              >
                <Input
                  dir="ltr"
                  value={socials[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setSocials({ ...socials, [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={saveSocials} disabled={busy !== null}>
              {he.save}
            </Button>
            {savedAt === 'socials' && <span className="text-sm text-ok font-semibold">{he.linktreeSaved}</span>}
          </div>
        </CardBody>
      </Card>

      {/* ── LinkTree page ───────────────────────────────────────── */}
      <Card>
        <CardHeader title={he.linktreeCardTitle} subtitle={he.linktreeCardSubtitle} />
        <CardBody className="space-y-5">
          {/* Business logo (shared with the branding page) */}
          <div className="flex items-center gap-4">
            <span className="w-20 h-20 rounded-full border border-line bg-paper grid place-items-center overflow-hidden shrink-0">
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt="" className="max-w-[80%] max-h-[80%] object-contain" />
              ) : (
                <span className="text-2xl" aria-hidden>
                  🎓
                </span>
              )}
            </span>
            <div className="flex-1 min-w-40">
              <p className="text-sm font-semibold text-ink">{he.linktreeLogo}</p>
              <p className="text-xs text-muted mt-0.5">{he.linktreeLogoHint}</p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy === 'logo'}
                  onClick={() => logoFileRef.current?.click()}
                >
                  {he.brandingUpload}
                </Button>
                {branding.logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy === 'logo'}
                    onClick={() => saveLogo(null)}
                  >
                    {he.brandingRemoveLogo}
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickLogo}
            />
          </div>

          {/* Publish + public URL */}
          <div className="flex flex-wrap items-center gap-3 bg-paper/70 border border-line rounded-xl px-4 py-3">
            <button
              type="button"
              role="switch"
              aria-checked={linktree.published}
              aria-label={he.linktreePublish}
              onClick={() => saveLinktree({ ...linktree, published: !linktree.published })}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors shrink-0',
                linktree.published ? 'bg-live' : 'bg-seat',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform',
                  linktree.published && 'translate-x-[-20px] rtl:translate-x-[-20px]',
                )}
              />
            </button>
            <div className="flex-1 min-w-40">
              <p className="text-sm font-semibold text-ink">{he.linktreePublish}</p>
              <p className="text-xs text-muted">{he.linktreePublishHint}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={copyUrl}>
                {copied ? he.linktreeCopied : he.linktreeCopyUrl}
              </Button>
              <a
                href={publicPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-semibold text-copper-600 hover:text-copper-500 transition-colors"
              >
                {he.linktreeOpenPreview}
              </a>
            </div>
          </div>
          <p className="text-xs text-muted -mt-2" dir="ltr">
            {publicPath}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={he.linktreeHeadline}>
              <Input
                value={linktree.headline}
                placeholder={he.linktreeHeadlinePlaceholder}
                onChange={(e) => setLinktree({ ...linktree, headline: e.target.value })}
              />
            </Field>
            <Field label={he.linktreeBio}>
              <Textarea
                rows={2}
                value={linktree.bio}
                placeholder={he.linktreeBioPlaceholder}
                onChange={(e) => setLinktree({ ...linktree, bio: e.target.value })}
              />
            </Field>
          </div>

          {/* Theme swatches */}
          <div>
            <p className="text-sm font-medium text-ink mb-2">{he.linktreeTheme}</p>
            <div className="flex flex-wrap gap-2.5">
              {(Object.keys(LANDING_THEMES) as LandingAccent[]).map((key) => {
                const t = LANDING_THEMES[key];
                const active = linktree.accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={t.name}
                    aria-label={t.name}
                    aria-pressed={active}
                    onClick={() => setLinktree({ ...linktree, accent: key })}
                    className={cn(
                      'w-9 h-9 rounded-full border-2 transition-transform',
                      active ? 'border-ink scale-110' : 'border-transparent hover:scale-105',
                    )}
                    style={{ background: `linear-gradient(135deg, ${t.deep}, ${t.main})` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Button style */}
          <div>
            <p className="text-sm font-medium text-ink mb-2">{he.linktreeButtonStyle}</p>
            <div className="inline-flex rounded-xl border border-line overflow-hidden">
              {LINKTREE_BUTTON_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={linktree.buttonStyle === s}
                  onClick={() => setLinktree({ ...linktree, buttonStyle: s })}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold transition-colors',
                    linktree.buttonStyle === s ? 'bg-ink text-card' : 'text-muted hover:text-ink',
                  )}
                >
                  {BUTTON_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-medium text-ink mb-1">{he.linktreeLinksTitle}</p>
            <p className="text-xs text-muted mb-3">{he.linktreeLinksHint}</p>
            {linktree.links.length === 0 && (
              <p className="text-sm text-muted bg-paper/70 border border-line rounded-xl px-4 py-3">
                {he.linktreeNoLinks}
              </p>
            )}
            <div className="space-y-3">
              {linktree.links.map((link, i) => (
                <div key={i} className="border border-line rounded-xl p-3 flex flex-wrap items-start gap-2.5">
                  <Input
                    className="!w-16 text-center"
                    value={link.emoji}
                    placeholder="🎓"
                    aria-label={he.linktreeLinkEmoji}
                    onChange={(e) => patchLink(i, { emoji: e.target.value })}
                  />
                  <Input
                    className="flex-1 min-w-36"
                    value={link.label}
                    placeholder={he.linktreeLinkLabel}
                    onChange={(e) => patchLink(i, { label: e.target.value })}
                  />
                  <Input
                    className="flex-1 min-w-48"
                    dir="ltr"
                    value={link.url}
                    placeholder={he.socialsUrlPlaceholder}
                    onChange={(e) => patchLink(i, { url: e.target.value })}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={he.linktreeMoveUp}
                      disabled={i === 0}
                      onClick={() => moveLink(i, -1)}
                      className="w-8 h-8 rounded-lg border border-line grid place-items-center text-muted hover:text-ink disabled:opacity-30 transition-colors"
                    >
                      <Icon name="arrowForward" size={13} className="rotate-90" />
                    </button>
                    <button
                      type="button"
                      aria-label={he.linktreeMoveDown}
                      disabled={i === linktree.links.length - 1}
                      onClick={() => moveLink(i, 1)}
                      className="w-8 h-8 rounded-lg border border-line grid place-items-center text-muted hover:text-ink disabled:opacity-30 transition-colors"
                    >
                      <Icon name="arrowForward" size={13} className="-rotate-90" />
                    </button>
                    <button
                      type="button"
                      aria-label={he.linktreeRemoveLink}
                      onClick={() =>
                        setLinktree({ ...linktree, links: linktree.links.filter((_, j) => j !== i) })
                      }
                      className="w-8 h-8 rounded-lg border border-line grid place-items-center text-muted hover:text-danger transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={linktree.links.length >= 30}
              onClick={() =>
                setLinktree({ ...linktree, links: [...linktree.links, { label: '', url: '', emoji: '' }] })
              }
            >
              + {he.linktreeAddLink}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => saveLinktree()} disabled={busy !== null}>
              {he.save}
            </Button>
            {savedAt === 'linktree' && (
              <span className="text-sm text-ok font-semibold">{he.linktreeSaved}</span>
            )}
            {error && <span className="text-sm text-danger font-medium">{error}</span>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
