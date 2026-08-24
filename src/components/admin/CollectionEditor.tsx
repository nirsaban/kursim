'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { collectionContentSchema, type CollectionContent, type CollectionInput } from '@/lib/validation/collection';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SaveBar from '@/components/admin/SaveBar';
import PaywallModal, { type PaywallInfo } from '@/components/admin/PaywallModal';
import { AccentPicker, EmojiPicker } from '@/components/admin/MarketingFields';

type CourseOpt = { id: string; title: string; priceAgorot: number | null; landingPublished: boolean };

export default function CollectionEditor({
  slug,
  collectionId,
  courses,
}: {
  slug: string;
  collectionId: string | null;
  courses: CourseOpt[];
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(collectionId);
  const [title, setTitle] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [content, setContent] = useState<CollectionContent>(collectionContentSchema.parse({}));
  const [published, setPublished] = useState(false);
  const [loaded, setLoaded] = useState(collectionId === null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paywall, setPaywall] = useState<PaywallInfo | null>(null);

  useEffect(() => {
    if (!collectionId) return;
    apiFetch(`/api/collections/${collectionId}`).then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setTitle(d.title);
      setCourseIds(d.courseIds);
      setContent(d.content);
      setPublished(d.published);
      setLoaded(true);
    });
  }, [collectionId]);

  const touch = () => {
    setDirty(true);
    setSaved(false);
    setError(null);
  };
  const patch = (p: Partial<CollectionContent>) => {
    setContent((c) => ({ ...c, ...p }));
    touch();
  };
  const toggleCourse = (cid: string) => {
    setCourseIds((ids) => (ids.includes(cid) ? ids.filter((x) => x !== cid) : [...ids, cid]));
    touch();
  };

  async function save() {
    if (courseIds.length < 2) {
      setError(he.collectionMinCourses);
      return;
    }
    setBusy(true);
    setError(null);
    const body: CollectionInput = { title: title || he.collectionsTitle, courseIds, content };
    const r = await apiFetch(id ? `/api/collections/${id}` : '/api/collections', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      setError(he.collectionSaveFailed);
      return;
    }
    setSaved(true);
    setDirty(false);
    if (!id) {
      const d = await r.json();
      setId(d.id);
      router.replace(`/t/${slug}/admin/collections/${d.id}`);
    }
  }

  async function togglePublish() {
    if (!id) return;
    const r = await apiFetch(`/api/collections/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ published: !published }),
    });
    if (r.ok) setPublished((await r.json()).published);
    else if (r.status === 402) setPaywall({ ...(await r.json().catch(() => ({}))), context: 'publish' });
  }

  async function remove() {
    if (!id || !window.confirm(he.confirmDelete)) return;
    const r = await apiFetch(`/api/collections/${id}`, { method: 'DELETE' });
    if (r.ok) router.push(`/t/${slug}/admin/collections`);
  }

  if (!loaded) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  const path = id ? `/t/${slug}/collection/${id}` : null;
  const url = path && typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
  const theme = LANDING_THEMES[content.accent];

  return (
    <div className="space-y-6">
      <PaywallModal info={paywall} onClose={() => setPaywall(null)} />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          {published ? (
            <Badge tone="ok" dot>
              {he.collectionPublished}
            </Badge>
          ) : (
            <Badge tone="neutral">{he.landingDraftBadge}</Badge>
          )}
          {url ? (
            <>
              <div className="flex-1 min-w-40">
                <code dir="ltr" className="block text-xs bg-paper border border-line rounded-lg px-3 py-2 truncate">
                  {url}
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? he.copied : he.copy}
              </Button>
              <a
                href={path!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                {he.landingPreview} ↗
              </a>
              <Button variant={published ? 'secondary' : 'cta'} size="sm" onClick={togglePublish} disabled={dirty}>
                {published ? he.collectionUnpublish : he.collectionPublish}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">{he.collectionSaveFirst}</p>
          )}
        </CardBody>
        {published && <p className="px-5 pb-4 text-xs text-muted -mt-2">{he.landingShareNote}</p>}
      </Card>

      <Card>
        <CardHeader title={he.collectionCourses} subtitle={he.collectionCoursesHint} />
        <CardBody className="space-y-4">
          <Field label={he.collectionTitleLabel}>
            <Input
              value={title}
              placeholder={he.collectionTitlePlaceholder}
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
            />
          </Field>
          <div className="space-y-2">
            {courses.map((c) => {
              const idx = courseIds.indexOf(c.id);
              return (
                <label key={c.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={idx >= 0}
                    onChange={() => toggleCourse(c.id)}
                    className="size-4 accent-copper-500"
                  />
                  {idx >= 0 && (
                    <span className="size-5 rounded-full bg-ink text-card text-[11px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                  )}
                  <span className="font-medium">{c.title}</span>
                  {!(c.priceAgorot && c.priceAgorot > 0) && (
                    <span className="text-xs text-muted">· {he.collectionCourseUnpriced}</span>
                  )}
                  {!c.landingPublished && (
                    <span className="text-xs text-warn">· {he.collectionCourseNoLanding}</span>
                  )}
                </label>
              );
            })}
          </div>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer border-t border-line pt-4">
            <input
              type="checkbox"
              checked={content.crossAddons}
              onChange={(e) => patch({ crossAddons: e.target.checked })}
              className="size-4 accent-copper-500 mt-0.5"
            />
            <span>
              <span className="font-medium block">{he.collectionCrossAddons}</span>
              <span className="text-xs text-muted">{he.collectionCrossAddonsHint}</span>
            </span>
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.collectionHero} />
        <CardBody className="space-y-4">
          <Field label={he.collectionHeadline}>
            <Input
              value={content.headline}
              placeholder={he.collectionHeadlinePlaceholder}
              onChange={(e) => patch({ headline: e.target.value })}
            />
          </Field>
          <Field label={he.collectionSubheadline}>
            <Input value={content.subheadline} onChange={(e) => patch({ subheadline: e.target.value })} />
          </Field>
          <Field label={he.collectionIntro}>
            <Textarea rows={4} value={content.intro} onChange={(e) => patch({ intro: e.target.value })} />
          </Field>
          <Field label={he.collectionCtaText}>
            <Input value={content.ctaText} placeholder={he.payNow} onChange={(e) => patch({ ctaText: e.target.value })} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${he.accentTitle} · ${he.emojiTitle}`} />
        <CardBody className="space-y-5">
          <AccentPicker value={content.accent} onChange={(accent) => patch({ accent })} />
          <EmojiPicker value={content.emoji} onChange={(emoji) => patch({ emoji })} />
          <div className="h-2 rounded-full" style={{ background: theme.main }} />
        </CardBody>
      </Card>

      <SaveBar
        busy={busy}
        saved={saved}
        dirty={dirty}
        error={error}
        onSave={save}
        right={
          id ? (
            <Button variant="danger" size="sm" onClick={remove}>
              {he.delete}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
