import { createHash } from 'crypto';

/** SHA-256 of an API key — the only form we ever store or compare. */
export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex');
