import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth/guards';
import { evictSession } from '@/lib/session-registry/registry';
import { clearAuthCookies } from '@/lib/auth/issue';

export async function POST() {
  const auth = await getAuth();
  if (auth) {
    // The device logged itself out — no eviction push needed.
    await evictSession(auth.sid, { notify: false });
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
