import { he } from '@/lib/he';

/** Rough, dependency-free device label from a User-Agent string (shown in "active devices" lists). */
export function deviceLabelFromUa(ua: string | null | undefined): string {
  if (!ua) return he.deviceUnknown;
  const os = /iPhone|iPad/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Mac OS X/i.test(ua)
        ? 'Mac'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Safari\//i.test(ua)
          ? 'Safari'
          : /Firefox\//i.test(ua)
            ? 'Firefox'
            : '';
  const label = [browser, os].filter(Boolean).join(' · ');
  return label || he.deviceUnknown;
}
