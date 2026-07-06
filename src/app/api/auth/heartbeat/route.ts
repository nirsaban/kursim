import { NextResponse } from 'next/server';
import { getAuth, unauthorized } from '@/lib/auth/guards';
import { touchSession } from '@/lib/session-registry/registry';

/** Player pings every 30s: slides session TTL, drives lastSeenAt ordering + live analytics. */
export async function POST() {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  await touchSession(auth.sid, auth.userId);
  return new NextResponse(null, { status: 204 });
}
