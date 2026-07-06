import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  clearedCookieOptions,
} from './cookies';

/**
 * The refresh cookie carries "sid.token" so /api/auth/refresh can locate the
 * session even after the access JWT has expired.
 */
export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  sid: string,
  refreshToken: string,
): void {
  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, `${sid}.${refreshToken}`, refreshCookieOptions());
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, '', clearedCookieOptions());
  res.cookies.set(REFRESH_COOKIE, '', clearedCookieOptions());
}

export function parseRefreshCookie(value: string | undefined): { sid: string; token: string } | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0 || dot === value.length - 1) return null;
  return { sid: value.slice(0, dot), token: value.slice(dot + 1) };
}
