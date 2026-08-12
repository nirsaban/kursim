/**
 * A seat is held by an **open screen**, not by a login.
 *
 * Every authenticated screen holds the SSE channel (`/api/auth/events`), which
 * touches its session every 25s; the lesson player also beats every 30s. So a
 * session whose last touch is older than this window has no screen behind it
 * any more — the tab was closed, the phone was put away, the cookies were
 * cleared — and its seat goes back to the pool.
 *
 * Two minutes = ~4 missed pings, enough to ride out a network blip or an app
 * restart without dropping the seat, short enough that closing a tab frees it
 * while the student is still standing there.
 *
 * Shared by the limiter (server) and the owner panel (client) so "connected
 * now" on screen means exactly what the limiter counts. Not env-tunable on
 * purpose: one number, one truth, no server/client drift.
 */
export const SCREEN_ACTIVE_WINDOW_MS = 2 * 60 * 1000;

/** True while a screen is still open behind this session. */
export function isScreenActive(lastSeenAt: number, now = Date.now()): boolean {
  return now - lastSeenAt < SCREEN_ACTIVE_WINDOW_MS;
}
