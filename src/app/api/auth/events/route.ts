import { NextRequest } from 'next/server';
import { getAuth, unauthorized } from '@/lib/auth/guards';
import { createSubscriber } from '@/lib/redis';
import { evictChannel, sessionExists, touchSession } from '@/lib/session-registry/registry';

export const dynamic = 'force-dynamic';

/**
 * SSE stream held by every authenticated screen. Publishes `evicted` the
 * moment this session is killed (device-limit eviction, admin kill,
 * suspension). A polling fallback also detects sessions that died without a
 * pub/sub message.
 *
 * The stream doubles as the proof that a screen is open: it touches the
 * session on connect and on every ping, which is what keeps the seat. Close
 * the tab and the pings stop, so the seat is released — that is how the limit
 * counts screens rather than logins.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuth();
  if (!auth) return unauthorized();

  const subscriber = createSubscriber();
  await subscriber.subscribe(evictChannel(auth.sid));

  const encoder = new TextEncoder();
  let closed = false;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        subscriber.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      send('connected', auth.sid);
      touchSession(auth.sid, auth.userId).catch(() => {});

      subscriber.on('message', (_channel, message) => {
        send('evicted', message || 'evicted');
        cleanup();
      });

      ping = setInterval(async () => {
        if (!(await sessionExists(auth.sid))) {
          send('evicted', 'expired');
          cleanup();
          return;
        }
        // The screen is still open — hold its seat.
        await touchSession(auth.sid, auth.userId).catch(() => {});
        send('ping', String(Date.now()));
      }, 25_000);

      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (ping) clearInterval(ping);
      subscriber.quit().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
