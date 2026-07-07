const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });

/** "לפני 2 דקות" / "אתמול" / date for anything older than a week. */
export function relativeHe(ts: number, now = Date.now()): string {
  const diffSec = Math.round((ts - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.trunc(diffSec / 1), 'second');
  if (abs < 3600) return rtf.format(Math.trunc(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.trunc(diffSec / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.trunc(diffSec / 86400), 'day');
  return new Date(ts).toLocaleDateString('he-IL');
}

/** True when the session pinged within the last two minutes. */
export function isLiveNow(lastSeenAt: number, now = Date.now()): boolean {
  return now - lastSeenAt < 2 * 60 * 1000;
}
