import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

// Prefer a system ffmpeg (set FFMPEG_PATH on Alpine, where the ffmpeg-static
// glibc binary won't run under musl); fall back to ffmpeg-static, then PATH.
const FFMPEG_BIN = process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg';

export interface ExtractedFrames {
  /** Temp working directory — caller must call cleanup() when done. */
  dir: string;
  mp4Path: string;
  framePaths: string[]; // frame_0001.jpg … in order
  posterPath: string;
  frameCount: number;
  cleanup: () => Promise<void>;
}

/**
 * Extract an mp4 into an ordered JPG frame sequence for scroll-scrubbing.
 * Normalizes to 30fps (an 8s clip → 240 frames), caps at `maxFrames`, and
 * copies the last frame as the poster. Returns the actual frame count.
 */
export async function extractFrames(mp4: Buffer, maxFrames = 240): Promise<ExtractedFrames> {
  const dir = await mkdtemp(join(tmpdir(), 'kursim-frames-'));
  const mp4Path = join(dir, 'clip.mp4');
  await writeFile(mp4Path, mp4);

  await run(FFMPEG_BIN, [
    '-y',
    '-i', mp4Path,
    '-vf', 'fps=30,scale=1280:-2:flags=lanczos',
    '-frames:v', String(maxFrames),
    '-q:v', '3',
    join(dir, 'frame_%04d.jpg'),
  ]);

  const framePaths = (await readdir(dir))
    .filter((f) => /^frame_\d{4}\.jpg$/.test(f))
    .sort()
    .map((f) => join(dir, f));
  if (framePaths.length === 0) throw new Error('ffmpeg produced no frames');

  const posterPath = join(dir, 'poster.jpg');
  await copyFile(framePaths[framePaths.length - 1]!, posterPath);

  return {
    dir,
    mp4Path,
    framePaths,
    posterPath,
    frameCount: framePaths.length,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
