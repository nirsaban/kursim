import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';
import { signedDeliveryUrl } from '@/lib/cloudinary/sign-delivery';
import { resolveKey } from '@/lib/media-store/paths';

const run = promisify(execFile);

// Same resolution order as lib/ai/frames.ts: FFMPEG_PATH (Alpine) → static → PATH.
const FFMPEG_BIN = process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg';

/** Signed URLs live only long enough for the worker to stream the file once. */
const FETCH_URL_TTL_SEC = 30 * 60;

export interface LessonAudio {
  /** Mono 64kbps MP3 of the lesson's soundtrack — what Gemini actually hears. */
  audio: Buffer;
  cleanup: () => Promise<void>;
}

async function fetchToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`media fetch ${res.status}`);
  await pipeline(
    Readable.fromWeb(res.body as unknown as NodeWebReadableStream<Uint8Array>),
    createWriteStream(dest),
  );
}

/**
 * Pull the lesson video from whichever backend holds it and squeeze it down to
 * an audio track. Video pixels are dead weight for transcription: a 2GB lesson
 * becomes ~30MB of MP3 (0.5MB/min), which uploads to Gemini in seconds and
 * keeps even multi-hour lessons far inside the model's ~9.5h audio window —
 * that is why there is no chunking path.
 */
export async function extractLessonAudio(
  videoPublicId: string,
  videoProvider: 'CLOUDINARY' | 'LOCAL',
): Promise<LessonAudio> {
  const dir = await mkdtemp(join(tmpdir(), 'kursim-stt-'));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    let source: string;
    if (videoProvider === 'LOCAL') {
      const abs = resolveKey(videoPublicId);
      if (!abs) throw new Error('LESSON_VIDEO_NOT_FOUND');
      await stat(abs).catch(() => {
        throw new Error('LESSON_VIDEO_NOT_FOUND');
      });
      source = abs; // already on this disk — no copy needed
    } else {
      source = join(dir, 'video');
      // The signed URL exists only in this process for the download; it is
      // never persisted and never logged.
      await fetchToFile(
        signedDeliveryUrl(videoPublicId, 'video', FETCH_URL_TTL_SEC, 'mp4'),
        source,
      );
    }

    const audioPath = join(dir, 'audio.mp3');
    await run(FFMPEG_BIN, [
      '-y',
      '-i', source,
      '-vn', // drop the video stream
      '-ac', '1',
      '-b:a', '64k',
      audioPath,
    ]);
    return { audio: await readFile(audioPath), cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}

/** MIME for an attachment, from its stored filename (uploads whitelist these). */
export function attachmentMime(filename: string, kind: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    txt: 'text/plain',
    md: 'text/plain',
    csv: 'text/csv',
  };
  return types[ext] ?? (kind === 'IMAGE' ? 'image/jpeg' : 'application/pdf');
}

/** Attachments Gemini can actually read — everything else is skipped, not failed. */
export function attachmentReadable(filename: string, kind: string): boolean {
  if (kind !== 'DOC' && kind !== 'IMAGE') return false;
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md', 'csv'].includes(ext);
}

/** Download an attachment (Cloudinary `raw`/`image`) into memory. */
export async function fetchAttachmentBytes(publicId: string, kind: string): Promise<Buffer> {
  const url = signedDeliveryUrl(publicId, kind === 'IMAGE' ? 'image' : 'raw', FETCH_URL_TTL_SEC);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`attachment fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
