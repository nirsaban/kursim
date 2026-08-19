import path from 'node:path';

/**
 * Lesson videos too big for Cloudinary (100MB on the Free plan) are stored on
 * this server's own disk instead. The layout mirrors the Cloudinary folders so
 * a key reads the same whichever backend holds it.
 *
 * MEDIA_ROOT must be a Docker volume — the container filesystem is thrown away
 * on every rebuild, and uploads with it.
 */
export function mediaRoot(): string {
  return process.env.MEDIA_ROOT ?? '/app/media';
}

/** Half-finished uploads live here until their parts are assembled. */
export function uploadsRoot(): string {
  return path.join(mediaRoot(), '.uploads');
}

/** Parts stay under nginx's 20MB body limit, so the proxy needs no changes. */
export const PART_SIZE = 8 * 1024 * 1024;

/**
 * Per-lesson ceiling. Unlimited by default — set MEDIA_MAX_UPLOAD_BYTES to put
 * a number back. With no ceiling, a single upload can fill the disk, and this
 * server hosts more than GeniriSchool.
 */
export function maxUploadBytes(): number {
  const configured = Number(process.env.MEDIA_MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : Infinity;
}

export function courseKeyPrefix(tenantId: string, courseId: string): string {
  return `tenants/${tenantId}/courses/${courseId}`;
}

export function tenantKeyPrefix(tenantId: string): string {
  return `tenants/${tenantId}`;
}

export function keyBelongsToCourse(key: string, tenantId: string, courseId: string): boolean {
  return key.startsWith(`${courseKeyPrefix(tenantId, courseId)}/`);
}

export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  return key.startsWith(`${tenantKeyPrefix(tenantId)}/`);
}

/**
 * Key for a new upload. The name is random and the extension whitelisted, so
 * nothing from the uploaded filename — separators, traversal, a double
 * extension — can reach the filesystem.
 */
export function newVideoKey(tenantId: string, courseId: string, filename: string): string {
  const ext = (filename.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] ?? 'mp4').toLowerCase();
  const safeExt = /^(mp4|mov|m4v|webm|mkv|avi)$/.test(ext) ? ext : 'mp4';
  const id = crypto.randomUUID().replace(/-/g, '');
  return `${courseKeyPrefix(tenantId, courseId)}/${id}.${safeExt}`;
}

/**
 * Absolute path for a key, or null if it would escape the media root. Every
 * filesystem call goes through here — a key arriving from a request is never
 * joined to the root directly.
 */
export function resolveKey(key: string): string | null {
  if (!key || key.startsWith('/') || key.includes('\0')) return null;
  if (key.split('/').some((segment) => segment === '..' || segment === '.')) return null;
  const root = path.resolve(mediaRoot());
  const abs = path.resolve(root, key);
  return abs === root || abs.startsWith(root + path.sep) ? abs : null;
}

/** Content type for the player, derived from the key's own extension. */
export function contentTypeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  const types: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
  };
  return types[ext] ?? 'application/octet-stream';
}
