import { createHash, randomBytes } from 'crypto';

/** Raw tokens are 192-bit random; only the SHA-256 hash is stored. */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
