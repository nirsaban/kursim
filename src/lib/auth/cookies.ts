export const ACCESS_COOKIE = 'kx_at';
export const REFRESH_COOKIE = 'kx_rt';

// Secure flag follows the deployed URL scheme so local docker (http://localhost)
// still works with NODE_ENV=production.
function isSecure(): boolean {
  return (process.env.APP_URL ?? '').startsWith('https://');
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure(),
    path: '/',
    maxAge: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 600),
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure(),
    path: '/',
    maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86400,
  };
}

export function clearedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure(),
    path: '/',
    maxAge: 0,
  };
}
