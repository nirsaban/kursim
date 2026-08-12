import { createHash, randomBytes } from 'crypto';

/**
 * Single-use auth tokens (password reset). Mirrors `@/lib/invites`: the raw
 * token is 192-bit random and leaves the server exactly once, inside the link
 * we email. Only its SHA-256 hash is stored, so a database leak can't be
 * replayed into account takeovers.
 */
export function generateAuthToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashAuthToken(token) };
}

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Reset links stay valid for one hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
