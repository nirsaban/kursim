import { describe, it, expect } from 'vitest';
import {
  CHUNK_SIZE,
  UploadError,
  formatBytes,
  planChunks,
  uploadErrorMessage,
} from '@/lib/client/upload';
import { FALLBACK_MEDIA_LIMITS, parseMediaLimits } from '@/lib/cloudinary/media-limits';
import { he } from '@/lib/he';

const MB = 1024 * 1024;

describe('planChunks', () => {
  it('sends a small file in one request', () => {
    expect(planChunks(3 * MB)).toEqual([{ start: 0, end: 3 * MB }]);
  });

  it('does not chunk a file that is exactly one chunk', () => {
    expect(planChunks(CHUNK_SIZE)).toHaveLength(1);
  });

  it('splits one byte past the chunk size into two ranges', () => {
    expect(planChunks(CHUNK_SIZE + 1)).toEqual([
      { start: 0, end: CHUNK_SIZE },
      { start: CHUNK_SIZE, end: CHUNK_SIZE + 1 },
    ]);
  });

  it('covers a large file contiguously with equal-sized chunks but the last', () => {
    const size = 101 * MB;
    const chunks = planChunks(size);

    expect(chunks[0].start).toBe(0);
    expect(chunks[chunks.length - 1].end).toBe(size);
    chunks.forEach((chunk, i) => {
      if (i > 0) expect(chunk.start).toBe(chunks[i - 1].end); // no gaps, no overlap
      // Cloudinary requires a uniform chunk size, with only the last one short.
      if (i < chunks.length - 1) expect(chunk.end - chunk.start).toBe(CHUNK_SIZE);
    });
    expect(chunks[chunks.length - 1].end - chunks[chunks.length - 1].start).toBeLessThanOrEqual(
      CHUNK_SIZE,
    );
  });

  it('honours a custom chunk size', () => {
    expect(planChunks(25, 10)).toEqual([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 20, end: 25 },
    ]);
  });
});

describe('formatBytes', () => {
  it('renders the plan limits the way the message needs them', () => {
    expect(formatBytes(100 * MB)).toBe('100MB');
    expect(formatBytes(10 * MB)).toBe('10MB');
    expect(formatBytes(1.5 * MB)).toBe('1.5MB');
  });
});

describe('uploadErrorMessage', () => {
  it('names the limit when the file is too big', () => {
    const msg = uploadErrorMessage(new UploadError('too_large', 'nope', 100 * MB));
    expect(msg).toBe(he.uploadTooLarge.replace('{size}', '100MB'));
    expect(msg).not.toContain('{size}');
  });

  it('falls back when the limit is unknown', () => {
    expect(uploadErrorMessage(new UploadError('too_large'))).toBe(he.uploadTooLargeUnknown);
  });

  it('distinguishes a dropped connection from a rejection', () => {
    expect(uploadErrorMessage(new UploadError('network'))).toBe(he.uploadNetworkError);
    expect(uploadErrorMessage(new UploadError('rejected', 'HTTP 401'))).toBe(he.uploadFailed);
  });

  it('degrades to the generic line for anything else', () => {
    expect(uploadErrorMessage(new Error('boom'))).toBe(he.uploadFailed);
    expect(uploadErrorMessage(undefined)).toBe(he.uploadFailed);
  });
});

describe('parseMediaLimits', () => {
  it('reads the Admin API shape', () => {
    expect(
      parseMediaLimits({
        image_max_size_bytes: 10485760,
        video_max_size_bytes: 104857600,
        raw_max_size_bytes: 10485760,
        image_max_px: 25000000,
      }),
    ).toEqual({ video: 104857600, image: 10485760, raw: 10485760 });
  });

  it('falls back per field on missing or nonsense values', () => {
    expect(parseMediaLimits({ video_max_size_bytes: 2147483648, image_max_size_bytes: 0 })).toEqual({
      video: 2147483648,
      image: FALLBACK_MEDIA_LIMITS.image,
      raw: FALLBACK_MEDIA_LIMITS.raw,
    });
    expect(parseMediaLimits({ video_max_size_bytes: 'lots' })).toEqual(FALLBACK_MEDIA_LIMITS);
    expect(parseMediaLimits(null)).toEqual(FALLBACK_MEDIA_LIMITS);
    expect(parseMediaLimits(undefined)).toEqual(FALLBACK_MEDIA_LIMITS);
  });
});
