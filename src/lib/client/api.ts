'use client';

/**
 * Client fetch wrapper: JSON by default, and on 401 tries one silent refresh
 * (rotating the refresh token) before retrying the original request. If the
 * refresh fails the session is dead — redirect to the login page.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const opts: RequestInit = {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  };
  let res = await fetch(path, opts);
  if (res.status === 401 && path !== '/api/auth/refresh') {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
    if (refreshed.ok) {
      res = await fetch(path, opts);
    } else {
      window.location.href = loginPathFor(window.location.pathname);
      return res;
    }
  }
  return res;
}

export function loginPathFor(pathname: string): string {
  const m = pathname.match(/^\/t\/([^/]+)/);
  return m ? `/t/${m[1]}/login` : '/superadmin/login';
}
