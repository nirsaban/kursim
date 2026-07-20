'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { TenantHomepage } from '@/lib/validation/homepage';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { AccentPicker, EmojiPicker } from './MarketingFields';
import HomepageAiBuilder from './ai-builder/HomepageAiBuilder';

type Announcement = TenantHomepage['announcements'][number];

export default function HomepageEditor({ slug }: { slug: string }) {
  const [hp, setHp] = useState<TenantHomepage | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [showAiBuilder, setShowAiBuilder] = useState(false);

  useEffect(() => {
    apiFetch('/api/settings/homepage')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setHp(d.homepage);
      });
    apiFetch('/api/courses')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setCourses(
            (d.courses as { id: string; title: string; status?: string }[]).filter(
              (c) => c.status === 'PUBLISHED',
            ),
          );
        }
      });
  }, []);

  if (!hp) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  const set = (patch: Partial<TenantHomepage>) => {
    setHp({ ...hp, ...patch });
    setSaved(false);
    setDirty(true);
  };

  async function saveHomepage(toSave: TenantHomepage) {
    setBusy(true);
    // Drop rows the owner added but never titled — the schema requires a title.
    const payload = { ...toSave, announcements: toSave.announcements.filter((a) => a.title.trim()) };
    const res = await apiFetch('/api/settings/homepage', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setHp(toSave);
      setSaved(true);
      setDirty(false);
    }
  }

  async function save() {
    if (!hp) return;
    await saveHomepage(hp);
  }

  return (
    <div className="space-y-6">
      {/* AI Builder */}
      {showAiBuilder ? (
        <HomepageAiBuilder
          tenantName={slug}
          currentHomepage={hp}
          onApply={set}
          onConfirm={saveHomepage}
          onClose={() => setShowAiBuilder(false)}
        />
      ) : (
        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{he.aiBuilderTitle}</p>
              <p className="text-sm text-muted mt-0.5">{he.aiBuilderSubtitle}</p>
            </div>
            <Button variant="secondary" onClick={() => setShowAiBuilder(true)}>
              {he.aiBuilderOpen}
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Welcome + about */}
      <Card>
        <CardHeader title={he.homepageWelcome} subtitle={he.homepageAboutSchoolHint} />
        <CardBody className="space-y-4">
          <Field label={he.homepageWelcomeHeadline}>
            <Input
              value={hp.welcomeHeadline}
              placeholder={he.homepageWelcomeHeadlinePlaceholder}
              onChange={(e) => set({ welcomeHeadline: e.target.value })}
            />
          </Field>
          <Field label={he.homepageAboutSchool}>
            <Textarea
              rows={4}
              value={hp.aboutSchool}
              onChange={(e) => set({ aboutSchool: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Announcements */}
      <Card>
        <CardHeader title={he.homepageAnnouncements} subtitle={he.homepageAnnouncementsHint} />
        <CardBody>
          <AnnouncementsEditor
            values={hp.announcements}
            onChange={(announcements) => set({ announcements })}
          />
        </CardBody>
      </Card>

      {/* Section toggles + featured course */}
      <Card>
        <CardHeader title={he.homepageSections} />
        <CardBody className="space-y-4">
          {(
            [
              ['showStats', he.homepageShowStats],
              ['showAchievements', he.homepageShowAchievements],
              ['showCatalog', he.homepageShowCatalog],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={hp[key]}
                onChange={(e) => set({ [key]: e.target.checked })}
                className="w-4 h-4 accent-brand-700"
              />
              {label}
            </label>
          ))}
          {hp.showCatalog && (
            <Field label={he.homepageFeaturedCourse}>
              <Select
                value={hp.featuredCourseId}
                onChange={(e) => set({ featuredCourseId: e.target.value })}
              >
                <option value="">{he.homepageFeaturedNone}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </CardBody>
      </Card>

      {/* Style */}
      <Card>
        <CardHeader title={he.homepageStyle} />
        <CardBody className="space-y-5">
          <AccentPicker value={hp.accent} onChange={(accent) => set({ accent })} />
          <EmojiPicker value={hp.emoji} onChange={(emoji) => set({ emoji })} />
        </CardBody>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-3 bg-card/95 backdrop-blur border border-line rounded-xl2 shadow-lift px-5 py-3">
        <Button onClick={save} disabled={busy}>
          {he.save}
        </Button>
        {saved && <span className="text-sm font-medium text-ok">{he.saved} ✓</span>}
        {dirty && !busy && (
          <span className="text-sm font-medium text-warn">{he.unsavedChanges}</span>
        )}
        <a
          href={`/t/${slug}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="ms-auto text-sm font-semibold text-brand-700 hover:underline"
        >
          {he.homepagePreview} ↗
        </a>
      </div>
    </div>
  );
}

/** Title + date + body rows — PairListEditor only supports two keys. */
function AnnouncementsEditor({
  values,
  onChange,
}: {
  values: Announcement[];
  onChange: (next: Announcement[]) => void;
}) {
  const update = (i: number, patch: Partial<Announcement>) =>
    onChange(values.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      {values.map((a, i) => (
        <div key={i} className="border border-line rounded-xl p-3 space-y-2 bg-paper/50">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Input
                value={a.title}
                placeholder={he.announcementTitle}
                onChange={(e) => update(i, { title: e.target.value })}
              />
            </div>
            {/* wrapper fixes the width — Input's base w-full can't be overridden by className */}
            <div className="w-40 shrink-0">
              <Input
                type="date"
                dir="ltr"
                value={a.date}
                aria-label={he.announcementDate}
                onChange={(e) => update(i, { date: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="shrink-0 w-9 h-9 rounded-xl border border-line text-muted hover:text-danger hover:border-danger/40 transition-colors text-sm"
              aria-label={he.removeItem}
            >
              ✕
            </button>
          </div>
          <Textarea
            rows={2}
            value={a.body}
            placeholder={he.announcementBody}
            onChange={(e) => update(i, { body: e.target.value })}
          />
        </div>
      ))}
      {values.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...values, { title: '', body: '', date: '' }])}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          + {he.addItem}
        </button>
      )}
    </div>
  );
}
