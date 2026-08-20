/** Shared mm:ss (or h:mm:ss) formatting + deep-link building for lesson video timestamps. */

export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Student lesson-page URL, seeking straight to `seconds` (see LessonPlayer's ?t= handling). */
export function lessonDeepLink(slug: string, lessonId: string, seconds?: number | null): string {
  const base = `/t/${slug}/lesson/${lessonId}`;
  if (seconds === null || seconds === undefined) return base;
  return `${base}?t=${Math.max(0, Math.round(seconds))}`;
}
