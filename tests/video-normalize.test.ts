import { describe, expect, it } from 'vitest';
import { needsNormalization, type VideoProbe } from '@/lib/media-store/normalize';

const GOOD: VideoProbe = {
  videoCodec: 'h264',
  audioCodec: 'aac',
  container: 'mov,mp4,m4a,3gp,3g2,mj2',
  bitRate: 3_500_000,
  durationSec: 94,
  fastStart: true,
};

describe('needsNormalization', () => {
  it('accepts a faststart h264/aac mp4 at a sane bitrate', () => {
    expect(needsNormalization(GOOD)).toBe(false);
  });

  it('rejects HEVC — the iPhone .mov case that broke playback', () => {
    expect(needsNormalization({ ...GOOD, videoCodec: 'hevc' })).toBe(true);
  });

  it('rejects moov-at-end files that cannot start before full download', () => {
    expect(needsNormalization({ ...GOOD, fastStart: false })).toBe(true);
  });

  it('rejects non-mp4 containers', () => {
    expect(needsNormalization({ ...GOOD, container: 'matroska,webm' })).toBe(true);
  });

  it('rejects camera-grade bitrates that buffer on streaming', () => {
    expect(needsNormalization({ ...GOOD, bitRate: 11_500_000 })).toBe(true);
  });

  it('rejects non-aac audio but tolerates a silent video', () => {
    expect(needsNormalization({ ...GOOD, audioCodec: 'pcm_s16le' })).toBe(true);
    expect(needsNormalization({ ...GOOD, audioCodec: null })).toBe(false);
  });
});
