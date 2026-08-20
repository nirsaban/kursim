import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat, rename, rm } from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import { UnrecoverableError } from 'bullmq';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { requestLessonTranscription } from '@/lib/transcription/service';
import { resolveKey } from './paths';

const run = promisify(execFile);

// Same resolution order as lib/ai/frames.ts: FFMPEG_PATH (Alpine) → static → PATH.
const FFMPEG_BIN = process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';

/**
 * Locally-stored lesson videos arrive as whatever the owner's camera produced —
 * in practice iPhone HEVC .mov with the moov atom at the end. That combination
 * is unplayable in Chrome/Firefox (no HEVC license) and unstreamable everywhere
 * (the browser needs the whole file before the first frame). Every LOCAL video
 * attach therefore queues a normalize job: probe, and when needed re-encode to
 * H.264/AAC MP4 with faststart — the one shape every browser streams.
 */

export interface VideoProbe {
  videoCodec: string;
  audioCodec: string | null;
  container: string;
  bitRate: number;
  durationSec: number;
  /** moov before mdat — playback can start while downloading. */
  fastStart: boolean;
}

/** Streamable-everywhere check. Anything failing one clause gets re-encoded. */
export function needsNormalization(p: VideoProbe): boolean {
  if (p.videoCodec !== 'h264') return true;
  if (p.audioCodec !== null && p.audioCodec !== 'aac') return true;
  if (!p.container.split(',').includes('mp4')) return true;
  if (!p.fastStart) return true;
  // 1080p at CRF 23 lands around 3-4 Mbps; far above that just buffers.
  if (p.bitRate > 8_000_000) return true;
  return false;
}

export async function probeVideo(absPath: string): Promise<VideoProbe> {
  const { stdout } = await run(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=format_name,bit_rate,duration',
    '-show_entries', 'stream=codec_name,codec_type',
    '-of', 'json',
    absPath,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { format_name?: string; bit_rate?: string; duration?: string };
    streams?: Array<{ codec_name?: string; codec_type?: string }>;
  };
  const video = data.streams?.find((s) => s.codec_type === 'video');
  const audio = data.streams?.find((s) => s.codec_type === 'audio');

  // faststart = the moov atom shows up before mdat in the first trace lines.
  const { stderr } = await run(FFPROBE_BIN, ['-v', 'trace', absPath], {
    maxBuffer: 64 * 1024 * 1024,
  }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? '' }));
  const moovAt = stderr.indexOf("type:'moov'");
  const mdatAt = stderr.indexOf("type:'mdat'");
  const fastStart = moovAt !== -1 && (mdatAt === -1 || moovAt < mdatAt);

  return {
    videoCodec: video?.codec_name ?? 'unknown',
    audioCodec: audio?.codec_name ?? null,
    container: data.format?.format_name ?? 'unknown',
    bitRate: Number(data.format?.bit_rate) || 0,
    durationSec: Number(data.format?.duration) || 0,
    fastStart,
  };
}

/** Re-encode into a sibling .tmp file, verify, then swap in as `<base>.mp4`. */
async function transcode(absIn: string, absOut: string, srcDuration: number): Promise<void> {
  const tmp = `${absOut}.tmp.mp4`;
  try {
    await run(
      FFMPEG_BIN,
      [
        '-y', '-v', 'error',
        '-i', absIn,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        tmp,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const out = await probeVideo(tmp);
    if (out.videoCodec !== 'h264' || Math.abs(out.durationSec - srcDuration) > 2) {
      throw new Error('NORMALIZE_VERIFY_FAILED');
    }
    await rename(tmp, absOut);
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

export interface NormalizeJob {
  tenantId: string;
  lessonId: string;
  /** The key the job was queued for — a later re-upload makes this job stale. */
  key: string;
}

/** Worker entry: probe, re-encode when needed, repoint the lesson, clean up. */
export async function runNormalizeJob(job: NormalizeJob): Promise<void> {
  const db = forTenant(job.tenantId);
  const lesson = await db.lesson.findFirst({
    where: { id: job.lessonId },
    select: { id: true, videoPublicId: true, videoProvider: true },
  });
  // The video changed or went away while we were queued — nothing to do.
  if (!lesson || lesson.videoProvider !== 'LOCAL' || lesson.videoPublicId !== job.key) return;

  const absIn = resolveKey(job.key);
  if (!absIn) throw new UnrecoverableError('LESSON_VIDEO_NOT_FOUND');
  const exists = await stat(absIn).catch(() => null);
  if (!exists) throw new UnrecoverableError('LESSON_VIDEO_NOT_FOUND');

  const probe = await probeVideo(absIn);
  if (needsNormalization(probe)) {
    const newKey = `${job.key.replace(/\.[A-Za-z0-9]+$/, '')}.norm.mp4`;
    const absOut = resolveKey(newKey)!;
    console.log(`[normalize] start lesson=${job.lessonId} codec=${probe.videoCodec} fastStart=${probe.fastStart}`);
    await transcode(absIn, absOut, probe.durationSec);

    // Repoint only if the lesson still holds the key this job encoded.
    const updated = await db.lesson.updateMany({
      where: { id: job.lessonId, videoPublicId: job.key },
      data: { videoPublicId: newKey },
    });
    if (updated.count === 0) {
      await rm(absOut, { force: true }).catch(() => {}); // superseded meanwhile
      return;
    }
    await rm(absIn, { force: true }).catch(() => {});
    console.log(`[normalize] done lesson=${job.lessonId} key=${newKey}`);
  } else {
    console.log(`[normalize] ok lesson=${job.lessonId} — already streamable`);
  }

  // Transcribe only now: the audio source is final, and the mentor gets it
  // exactly once per uploaded video.
  await requestLessonTranscription(job.tenantId, job.lessonId, { force: true }).catch(() => {});
}
