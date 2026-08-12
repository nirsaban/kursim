'use client';

import { apiFetch } from './api';
import { he } from '@/lib/he';

export interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: 'authenticated';
  resourceType: 'video' | 'image' | 'raw';
  /** Account cap for this asset kind; 0/undefined means "don't pre-check". */
  maxBytes?: number;
  /** Where an over-cap file can go instead, if anywhere. */
  fallback?: 'local' | null;
}

export interface CloudinaryUploadResult {
  public_id: string;
  duration?: number;
  bytes: number;
}

export type UploadErrorCode = 'too_large' | 'rejected' | 'network' | 'not_configured';

/** Carries *why* an upload died, so the UI can say more than "it failed". */
export class UploadError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    readonly detail?: string,
    readonly limitBytes?: number,
    readonly status?: number,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'UploadError';
  }
}

/**
 * Cloudinary refuses a single upload request over 100MB, so anything larger has
 * to go up in chunks. Chunks must be at least 5MB (the last one excepted) and
 * all the same size; 20MB is Cloudinary's own default and keeps even a 2GB
 * video to ~100 requests.
 */
export const CHUNK_SIZE = 20 * 1024 * 1024;

/** Byte ranges to send, in order. A file that fits in one chunk yields one range. */
export function planChunks(
  size: number,
  chunkSize: number = CHUNK_SIZE,
): Array<{ start: number; end: number }> {
  if (size <= chunkSize) return [{ start: 0, end: size }];
  const chunks: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < size; start += chunkSize) {
    chunks.push({ start, end: Math.min(start + chunkSize, size) });
  }
  return chunks;
}

/** "100MB" / "10MB" / "1.5MB" — for the size-limit message. */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 || Number.isInteger(mb) ? Math.round(mb) : mb.toFixed(1)}MB`;
}

/** Hebrew copy for a failed upload — falls back to the generic line. */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadError) {
    if (err.code === 'not_configured') return he.cloudinaryMissing;
    if (err.code === 'too_large') {
      return err.limitBytes
        ? he.uploadTooLarge.replace('{size}', formatBytes(err.limitBytes))
        : he.uploadTooLargeUnknown;
    }
    if (err.code === 'network') return he.uploadNetworkError;
  }
  return he.uploadFailed;
}

/** Ask the API to sign a direct upload into this course's tenant folder. */
export async function signCourseUpload(
  courseId: string,
  kind: 'video' | 'image' | 'raw',
): Promise<{ sign: SignResponse } | { error: 'not_configured' | 'failed' }> {
  const res = await apiFetch('/api/media/sign-upload', {
    method: 'POST',
    body: JSON.stringify({ courseId, kind }),
  });
  if (res.status === 503) return { error: 'not_configured' };
  if (!res.ok) return { error: 'failed' };
  return { sign: await res.json() };
}

function newUploadId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** Cloudinary reports failures as `{"error":{"message":"..."}}`. */
function cloudinaryError(responseText: string): string | undefined {
  try {
    const body = JSON.parse(responseText);
    return typeof body?.error?.message === 'string' ? body.error.message : undefined;
  } catch {
    return undefined;
  }
}

/**
 * POSTs one chunk (or a whole small file, when `range` is null). Returns the
 * asset on the final chunk and null for the intermediate ones, which Cloudinary
 * answers with `{"done": false}`.
 */
function postChunk(
  url: string,
  sign: SignResponse,
  blob: Blob,
  filename: string,
  uploadId: string | null,
  range: { start: number; end: number; total: number } | null,
  onLoaded: (loadedInChunk: number) => void,
): Promise<CloudinaryUploadResult | null> {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);
  form.append('type', sign.type);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (uploadId && range) {
      // Chunked upload: same signed params on every part, tied together by the
      // upload id, with the byte range telling Cloudinary where this part goes.
      xhr.setRequestHeader('X-Unique-Upload-Id', uploadId);
      xhr.setRequestHeader('Content-Range', `bytes ${range.start}-${range.end - 1}/${range.total}`);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status === 413) {
        reject(new UploadError('too_large', cloudinaryError(xhr.responseText), sign.maxBytes));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new UploadError('rejected', cloudinaryError(xhr.responseText) ?? `HTTP ${xhr.status}`),
        );
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new UploadError('rejected', 'unreadable response'));
        return;
      }
      const done = (body as { done?: boolean }).done;
      resolve(done === false ? null : (body as CloudinaryUploadResult));
    };
    xhr.onerror = () => reject(new UploadError('network'));
    xhr.ontimeout = () => reject(new UploadError('network'));
    xhr.onabort = () => reject(new UploadError('network'));
    xhr.send(form);
  });
}

/**
 * Direct browser→Cloudinary upload with progress, chunking anything over
 * CHUNK_SIZE. A file past the account's cap is refused here instead of after a
 * full upload that Cloudinary would answer with a 413. Throws UploadError.
 */
export async function uploadToCloudinary(
  file: File,
  sign: SignResponse,
  onProgress: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  if (sign.maxBytes && file.size > sign.maxBytes) {
    throw new UploadError('too_large', `${file.size} > ${sign.maxBytes}`, sign.maxBytes);
  }

  const url = `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`;
  const chunks = planChunks(file.size);
  const uploadId = chunks.length > 1 ? newUploadId() : null;
  const pct = (bytes: number) =>
    Math.min(100, file.size ? Math.round((bytes / file.size) * 100) : 100);

  let result: CloudinaryUploadResult | null = null;
  let uploaded = 0;
  for (const chunk of chunks) {
    const before = uploaded;
    result = await postChunk(
      url,
      sign,
      file.slice(chunk.start, chunk.end),
      file.name,
      uploadId,
      uploadId ? { ...chunk, total: file.size } : null,
      (loadedInChunk) => onProgress(pct(before + loadedInChunk)),
    );
    uploaded = chunk.end;
    onProgress(pct(uploaded));
  }

  // Only reachable if Cloudinary answered every chunk with `done: false`.
  if (!result) throw new UploadError('rejected', 'no asset returned');
  return result;
}

// ── Local fallback: videos too big for the Cloudinary plan ───────────────────

export type VideoProvider = 'CLOUDINARY' | 'LOCAL';

export interface VideoUploadResult {
  provider: VideoProvider;
  /** Cloudinary public_id, or the stored object key on local disk. */
  publicId: string;
  durationSec: number | null;
  bytes: number;
}

interface UploadPlan {
  key: string;
  uploadId: string;
  partSize: number;
  parts: number;
}

/**
 * Only Cloudinary reports a duration; for a locally stored file we ask the
 * browser instead. Best-effort — a codec it can't parse just means no badge.
 */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/** POSTs one chunk as a raw body. XHR is used for its upload progress events. */
function sendPart(url: string, blob: Blob, onLoaded: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new UploadError('rejected', `part ${xhr.status}`, undefined, xhr.status));
        return;
      }
      resolve();
    };
    xhr.onerror = () => reject(new UploadError('network'));
    xhr.ontimeout = () => reject(new UploadError('network'));
    xhr.onabort = () => reject(new UploadError('network'));
    xhr.send(blob);
  });
}

/**
 * A multi-gigabyte upload can outlive the access token. XHR doesn't go through
 * apiFetch's refresh, so a 401 mid-upload gets one silent rotate-and-retry
 * rather than throwing away an hour of transfer.
 */
async function putPart(url: string, blob: Blob, onLoaded: (loaded: number) => void): Promise<void> {
  try {
    await sendPart(url, blob, onLoaded);
  } catch (err) {
    if (!(err instanceof UploadError) || err.status !== 401) throw err;
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!refreshed.ok) throw err;
    await sendPart(url, blob, onLoaded);
  }
}

/**
 * Chunked upload to this server's own disk. Parts are sized by the server to
 * stay under the proxy's request-body limit, and each one streams to disk as it
 * arrives, so a multi-GB file never sits in memory on either end.
 */
async function uploadToServer(
  courseId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const created = await apiFetch('/api/media/local/create', {
    method: 'POST',
    body: JSON.stringify({ courseId, filename: file.name, bytes: file.size }),
  });
  if (created.status === 503) throw new UploadError('not_configured');
  if (created.status === 413) throw new UploadError('too_large', 'over the server ceiling');
  if (!created.ok) throw new UploadError('rejected', `create ${created.status}`);
  const plan: UploadPlan = await created.json();

  const chunks = planChunks(file.size, plan.partSize);
  const pct = (bytes: number) =>
    Math.min(100, file.size ? Math.round((bytes / file.size) * 100) : 100);
  let uploaded = 0;

  try {
    for (let i = 0; i < chunks.length; i++) {
      const before = uploaded;
      await putPart(
        `/api/media/local/part?uploadId=${encodeURIComponent(plan.uploadId)}&part=${i + 1}`,
        file.slice(chunks[i].start, chunks[i].end),
        (loaded) => onProgress(pct(before + loaded)),
      );
      uploaded = chunks[i].end;
      onProgress(pct(uploaded));
    }
  } catch (err) {
    // Abandoned parts sit on the disk until something removes them.
    apiFetch('/api/media/local/abort', {
      method: 'POST',
      body: JSON.stringify({ uploadId: plan.uploadId }),
    }).catch(() => {});
    throw err;
  }

  const done = await apiFetch('/api/media/local/complete', {
    method: 'POST',
    body: JSON.stringify({ uploadId: plan.uploadId }),
  });
  if (!done.ok) throw new UploadError('rejected', `complete ${done.status}`);
  return (await done.json()).key as string;
}

/**
 * Uploads a lesson video to whichever backend can hold it: Cloudinary while it
 * fits under the plan's cap, this server's disk above it. Callers get one shape
 * back and don't need to know which one ran. Throws UploadError.
 */
export async function uploadCourseVideo(
  courseId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<VideoUploadResult> {
  const signed = await signCourseUpload(courseId, 'video');
  if ('error' in signed) {
    throw signed.error === 'not_configured'
      ? new UploadError('not_configured')
      : new UploadError('rejected', 'signing failed');
  }
  const sign = signed.sign;
  const overCap = Boolean(sign.maxBytes && file.size > sign.maxBytes);

  if (!overCap) {
    const result = await uploadToCloudinary(file, sign, onProgress);
    return {
      provider: 'CLOUDINARY',
      publicId: result.public_id,
      durationSec: result.duration ? Math.round(result.duration) : null,
      bytes: result.bytes,
    };
  }

  if (sign.fallback !== 'local') {
    throw new UploadError('too_large', `${file.size} > ${sign.maxBytes}`, sign.maxBytes);
  }

  // Read the duration before uploading: after this the file may be gigabytes
  // in flight, and we still want a runtime on the lesson.
  const durationSec = await readVideoDuration(file);
  const key = await uploadToServer(courseId, file, onProgress);
  return { provider: 'LOCAL', publicId: key, durationSec, bytes: file.size };
}
