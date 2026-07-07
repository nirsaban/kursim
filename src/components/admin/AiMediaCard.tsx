'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

type Status = 'idle' | 'generating' | 'ready' | 'failed';

interface MediaState {
  status: Status;
  posterUrl?: string | null;
  error?: string | null;
}

/**
 * Owner control to generate the AI marketing video (Veo) + stills for a course.
 * Kicks off a background job and polls status until ready/failed.
 */
export default function AiMediaCard({ courseId }: { courseId: string }) {
  const [state, setState] = useState<MediaState>({ status: 'idle' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch(`/api/courses/${courseId}/media`);
    if (!r.ok) return;
    const d = await r.json();
    setState({ status: d.status as Status, posterUrl: d.posterUrl, error: d.error });
    return d.status as Status;
  }, [courseId]);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  // Poll every 5s while a job is running.
  useEffect(() => {
    if (state.status !== 'generating') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(load, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.status, load]);

  async function generate() {
    setBusy(true);
    setNotice(null);
    const r = await apiFetch(`/api/courses/${courseId}/generate-media`, { method: 'POST' });
    setBusy(false);
    if (r.ok) {
      setState((s) => ({ ...s, status: 'generating' }));
      return;
    }
    const d = await r.json().catch(() => ({}));
    if (d.error === 'ai_disabled') setNotice(he.aiMediaDisabled);
    else if (d.error === 'cloudinary_missing') setNotice(he.aiMediaCloudinaryMissing);
    else if (d.error === 'already_generating') setState((s) => ({ ...s, status: 'generating' }));
    else setNotice(he.aiMediaFailed);
  }

  const generating = state.status === 'generating';

  return (
    <Card>
      <CardHeader
        title={he.aiMediaTitle}
        subtitle={he.aiMediaHint}
        actions={
          state.status === 'ready' ? (
            <Badge tone="ok" dot>
              {he.aiMediaReady}
            </Badge>
          ) : generating ? (
            <Badge tone="warn" dot>
              {he.aiMediaGenerating}
            </Badge>
          ) : state.status === 'failed' ? (
            <Badge tone="danger" dot>
              {he.aiMediaFailed}
            </Badge>
          ) : null
        }
      />
      <CardBody>
        <div className="flex flex-wrap items-center gap-4">
          {state.status === 'ready' && state.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.posterUrl}
              alt=""
              className="h-20 w-32 rounded-xl object-cover border border-line shrink-0"
            />
          )}
          <div className="min-w-0">
            {state.status === 'ready' && <p className="text-sm text-ok mb-3">✓ {he.aiMediaReady}</p>}
            {generating && (
              <p className="text-sm text-warn mb-3 flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-warn border-t-transparent animate-spin" />
                {he.aiMediaGenerating}
              </p>
            )}
            {state.status === 'failed' && state.error && (
              <p className="text-sm text-danger mb-3" dir="ltr">
                {state.error}
              </p>
            )}
            {notice && <p className="text-sm text-danger mb-3">{notice}</p>}
            <Button variant={state.status === 'ready' ? 'secondary' : 'cta'} onClick={generate} disabled={busy || generating}>
              {state.status === 'ready' ? he.aiMediaRegenerate : he.aiMediaGenerate}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
