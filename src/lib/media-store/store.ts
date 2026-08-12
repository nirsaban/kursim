import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import {
  PART_SIZE,
  courseKeyPrefix,
  mediaRoot,
  newVideoKey,
  resolveKey,
  tenantKeyPrefix,
  uploadsRoot,
} from './paths';

export interface UploadMeta {
  tenantId: string;
  courseId: string;
  key: string;
  bytes: number;
  parts: number;
}

const UPLOAD_ID_RE = /^[0-9a-f]{32}$/;

function uploadDir(uploadId: string): string | null {
  if (!UPLOAD_ID_RE.test(uploadId)) return null;
  return path.join(uploadsRoot(), uploadId);
}

export function partCount(bytes: number, partSize: number = PART_SIZE): number {
  return Math.max(1, Math.ceil(bytes / partSize));
}

/** The store is usable as soon as its root can be created and written. */
export async function isMediaStoreWritable(): Promise<boolean> {
  try {
    await fs.mkdir(uploadsRoot(), { recursive: true });
    await fs.access(mediaRoot(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Opens an upload: reserves a key and a scratch directory for its parts. */
export async function createUpload(
  tenantId: string,
  courseId: string,
  filename: string,
  bytes: number,
): Promise<{ uploadId: string; key: string; partSize: number; parts: number }> {
  const uploadId = crypto.randomUUID().replace(/-/g, '');
  const dir = uploadDir(uploadId)!;
  await fs.mkdir(dir, { recursive: true });
  const meta: UploadMeta = {
    tenantId,
    courseId,
    key: newVideoKey(tenantId, courseId, filename),
    bytes,
    parts: partCount(bytes),
  };
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta), 'utf8');
  return { uploadId, key: meta.key, partSize: PART_SIZE, parts: meta.parts };
}

export async function readUploadMeta(uploadId: string): Promise<UploadMeta | null> {
  const dir = uploadDir(uploadId);
  if (!dir) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8')) as UploadMeta;
  } catch {
    return null;
  }
}

/** Streams one part straight to disk — the whole file is never held in memory. */
export async function writePart(
  uploadId: string,
  partNumber: number,
  body: ReadableStream<Uint8Array>,
): Promise<void> {
  const dir = uploadDir(uploadId);
  if (!dir) throw new Error('bad upload id');
  const target = path.join(dir, `part-${String(partNumber).padStart(5, '0')}`);
  await pipeline(
    Readable.fromWeb(body as unknown as NodeWebReadableStream<Uint8Array>),
    createWriteStream(target),
  );
}

/**
 * Concatenates the parts into the final file. Returns null if a part is missing
 * or the assembled size doesn't match what was declared, so a truncated upload
 * can never be attached to a lesson.
 */
export async function completeUpload(uploadId: string): Promise<string | null> {
  const dir = uploadDir(uploadId);
  const meta = await readUploadMeta(uploadId);
  if (!dir || !meta) return null;

  const abs = resolveKey(meta.key);
  if (!abs) return null;
  await fs.mkdir(path.dirname(abs), { recursive: true });

  // Appended one part at a time, streaming — a 2GB file never lands in memory.
  const out = createWriteStream(abs);
  try {
    for (let i = 1; i <= meta.parts; i++) {
      const part = path.join(dir, `part-${String(i).padStart(5, '0')}`);
      await new Promise<void>((resolve, reject) => {
        const input = createReadStream(part);
        input.on('error', reject);
        input.on('end', resolve);
        input.pipe(out, { end: false });
      });
    }
    await new Promise<void>((resolve) => out.end(resolve));
  } catch {
    out.destroy();
    await fs.rm(abs, { force: true });
    await abortUpload(uploadId);
    return null;
  }

  const written = await fs.stat(abs).catch(() => null);
  if (!written || written.size !== meta.bytes) {
    await fs.rm(abs, { force: true });
    await abortUpload(uploadId);
    return null;
  }

  await abortUpload(uploadId); // scratch dir has served its purpose
  return meta.key;
}

export async function abortUpload(uploadId: string): Promise<void> {
  const dir = uploadDir(uploadId);
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

/** Best-effort delete — cleanup must never block the delete the user asked for. */
export async function deleteMediaKeys(keys: string[]): Promise<void> {
  for (const key of keys) {
    const abs = resolveKey(key);
    if (abs) await fs.rm(abs, { force: true }).catch(() => {});
  }
}

async function destroyPrefix(prefix: string): Promise<void> {
  const abs = resolveKey(prefix);
  if (!abs) return;
  await fs.rm(abs, { recursive: true, force: true }).catch(() => {});
}

export function destroyLocalCoursePrefix(tenantId: string, courseId: string): Promise<void> {
  return destroyPrefix(courseKeyPrefix(tenantId, courseId));
}

export function destroyLocalTenantPrefix(tenantId: string): Promise<void> {
  return destroyPrefix(tenantKeyPrefix(tenantId));
}
